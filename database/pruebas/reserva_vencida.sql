-- Prueba de reserva vencida. Para no esperar 15 minutos, la prueba adelanta el
-- vencimiento con un UPDATE directo (por eso se ejecuta con un usuario
-- administrador y no con shopcart_app). Comprueba que una reserva vencida:
--   1. deja de restar del disponible;
--   2. permite que otro cliente reserve esa existencia;
--   3. ya no se puede convertir en pedido (52409);
--   4. al iniciar el pago otra vez se anula y no bloquea un pago nuevo.
-- Crea un producto y dos clientes con nombres únicos y los deja, como las pruebas de la API.
-- Uso: sqlcmd -S <servidor> -d ShopCart -I -b -i database/pruebas/reserva_vencida.sql
SET NOCOUNT ON;
SET XACT_ABORT OFF;

DECLARE @Marca NVARCHAR(20) = CONVERT(NVARCHAR(20), DATEDIFF_BIG(MILLISECOND, '2026-01-01', SYSUTCDATETIME()));
DECLARE @Admin INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'admin@shopcart.test');
DECLARE @CorreoA NVARCHAR(150) = N'vencida-a-' + @Marca + N'@shopcart.test';
DECLARE @CorreoB NVARCHAR(150) = N'vencida-b-' + @Marca + N'@shopcart.test';
DECLARE @Nombre NVARCHAR(150) = N'Prueba reserva vencida ' + @Marca;
DECLARE @SKU NVARCHAR(40) = N'VENC-' + @Marca;
DECLARE @A INT, @B INT, @IDProducto INT, @IDVariante INT, @Reserva1 INT, @Reserva2 INT, @ReservaB INT,
        @Disponible INT, @Error INT, @Mensaje NVARCHAR(4000);

-- Un producto con 2 unidades y dos clientes. Los SP devuelven resultados que aquí no se usan.
EXEC dbo.SP_Catalogo_CrearProducto @IDUsuario = @Admin, @IDCategoria = 1, @Nombre = @Nombre;
SET @IDProducto = (SELECT IDProducto FROM dbo.Productos WHERE Nombre = @Nombre);
EXEC dbo.SP_Catalogo_CrearVariante @IDUsuario = @Admin, @IDProducto = @IDProducto, @SKU = @SKU, @Precio = 50, @ExistenciaInicial = 2;
SET @IDVariante = (SELECT IDVariante FROM dbo.Variantes WHERE SKU = @SKU);
EXEC dbo.SP_Auth_Registrar @Correo = @CorreoA, @ClaveHash = N'sin-uso', @Nombre = N'Prueba A';
EXEC dbo.SP_Auth_Registrar @Correo = @CorreoB, @ClaveHash = N'sin-uso', @Nombre = N'Prueba B';
SET @A = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = @CorreoA);
SET @B = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = @CorreoB);

-- El cliente A reserva las 2 unidades.
EXEC dbo.SP_Carrito_Agregar @IDUsuario = @A, @IDVariante = @IDVariante, @Cantidad = 2;
EXEC dbo.SP_Checkout_IniciarPago @IDUsuario = @A, @Direccion = N'Prueba', @Ciudad = N'Guatemala', @Telefono = N'1';
SET @Reserva1 = (SELECT IDReserva FROM dbo.Reservas WHERE IDUsuario = @A AND Estado = N'Activa');
SET @Disponible = (SELECT Disponible FROM dbo.FU_Inventario_Disponibilidad() WHERE IDVariante = @IDVariante);
IF @Reserva1 IS NULL OR @Disponible <> 0 THROW 50000, N'FALLO: la reserva inicial no restó del disponible.', 1;
PRINT N'OK: la reserva activa resta del disponible';

-- Se simula que pasaron los 15 minutos.
UPDATE dbo.Reservas SET Expira = DATEADD(MINUTE, -1, SYSUTCDATETIME()) WHERE IDReserva = @Reserva1;

-- 1. La reserva vencida ya no resta.
SET @Disponible = (SELECT Disponible FROM dbo.FU_Inventario_Disponibilidad() WHERE IDVariante = @IDVariante);
IF @Disponible <> 2 THROW 50000, N'FALLO: la reserva vencida sigue restando del disponible.', 1;
PRINT N'OK: la reserva vencida deja de restar del disponible';

-- 2. El cliente B puede reservar esa existencia.
EXEC dbo.SP_Carrito_Agregar @IDUsuario = @B, @IDVariante = @IDVariante, @Cantidad = 2;
EXEC dbo.SP_Checkout_IniciarPago @IDUsuario = @B, @Direccion = N'Prueba', @Ciudad = N'Guatemala', @Telefono = N'2';
SET @ReservaB = (SELECT IDReserva FROM dbo.Reservas WHERE IDUsuario = @B AND Estado = N'Activa');
IF @ReservaB IS NULL THROW 50000, N'FALLO: otro cliente no pudo reservar la existencia liberada.', 1;
PRINT N'OK: otro cliente reserva la existencia liberada';

-- 3. La reserva vencida no se convierte en pedido.
BEGIN TRY
    EXEC dbo.SP_Pedidos_CrearPedido @IDUsuario = @A, @IDReserva = @Reserva1;
END TRY
BEGIN CATCH
    SELECT @Error = ERROR_NUMBER(), @Mensaje = ERROR_MESSAGE();
END CATCH;
IF ISNULL(@Error, 0) <> 52409 OR @Mensaje NOT LIKE N'%venció%'
    THROW 50000, N'FALLO: se pudo crear un pedido con una reserva vencida.', 1;
IF EXISTS (SELECT 1 FROM dbo.Pedidos WHERE IDReserva = @Reserva1) THROW 50000, N'FALLO: quedó un pedido de la reserva vencida.', 1;
PRINT N'OK: una reserva vencida no se convierte en pedido (52409)';

-- 4. Iniciar el pago otra vez anula la vencida (no es un doble clic). Como B tiene
--    reservadas las 2 unidades, A recibe el rechazo por existencia.
SET @Error = NULL;
BEGIN TRY
    EXEC dbo.SP_Checkout_IniciarPago @IDUsuario = @A, @Direccion = N'Prueba', @Ciudad = N'Guatemala', @Telefono = N'1';
END TRY
BEGIN CATCH
    SELECT @Error = ERROR_NUMBER(), @Mensaje = ERROR_MESSAGE();
END CATCH;
IF ISNULL(@Error, 0) <> 52409 OR @Mensaje NOT LIKE N'%existencia suficiente%'
    THROW 50000, N'FALLO: el cliente A volvió a reservar existencia que ya tenía B.', 1;
PRINT N'OK: al volver a pagar sin existencia se rechaza con la causa';

-- B cancela su pago y A puede iniciar uno nuevo: se crea otra reserva y la vencida queda Anulada.
EXEC dbo.SP_Checkout_CancelarPago @IDUsuario = @B, @IDReserva = @ReservaB;
EXEC dbo.SP_Checkout_IniciarPago @IDUsuario = @A, @Direccion = N'Prueba', @Ciudad = N'Guatemala', @Telefono = N'1';
SET @Reserva2 = (SELECT IDReserva FROM dbo.Reservas WHERE IDUsuario = @A AND Estado = N'Activa');
IF @Reserva2 IS NULL OR @Reserva2 = @Reserva1 THROW 50000, N'FALLO: no se creó una reserva nueva después de la vencida.', 1;
IF (SELECT Estado FROM dbo.Reservas WHERE IDReserva = @Reserva1) <> N'Anulada'
    THROW 50000, N'FALLO: la reserva vencida no quedó Anulada.', 1;
PRINT N'OK: un pago nuevo crea otra reserva y anula la vencida';

-- Se libera lo reservado para no dejar existencia apartada.
EXEC dbo.SP_Checkout_CancelarPago @IDUsuario = @A, @IDReserva = @Reserva2;
GO
