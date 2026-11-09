-- Prueba directa de la regla de despacho y entrega en SP_Pedidos_CambiarEstado.
-- Cada caso crea su pedido dentro de una transacción y la deshace al terminar. El caso
-- de atomicidad necesita confirmar sus datos: los borra al final y no deja nada.
-- Ante un fallo el script se detiene con error.
-- Uso: sqlcmd -S <servidor> -d ShopCart -I -b -i database/pruebas/despacho.sql
SET NOCOUNT ON;
GO

-- Pedido mínimo de prueba (una línea de 2 unidades) en el estado indicado.
CREATE PROCEDURE #PedidoDePrueba
    @Estado   NVARCHAR(20),
    @IDPedido INT OUTPUT
AS
BEGIN
    DECLARE @IDUsuario INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'cliente@shopcart.test');
    DECLARE @IDVariante INT, @Precio DECIMAL(12,2), @IDCarrito INT, @IDDireccion INT, @IDReserva INT;
    SELECT TOP (1) @IDVariante = IDVariante, @Precio = Precio FROM dbo.Variantes WHERE Existencia > 0 ORDER BY IDVariante;

    INSERT INTO dbo.Direcciones (IDUsuario, Direccion, Ciudad, Telefono) VALUES (@IDUsuario, N'Prueba', N'Prueba', N'0');
    SET @IDDireccion = SCOPE_IDENTITY();
    INSERT INTO dbo.Carritos (IDUsuario, Estado) VALUES (@IDUsuario, N'Convertido');
    SET @IDCarrito = SCOPE_IDENTITY();
    INSERT INTO dbo.Reservas (IDUsuario, IDCarrito, Estado, Expira, Subtotal, Descuento, Total, IDDireccion, Direccion, Ciudad, Telefono)
    VALUES (@IDUsuario, @IDCarrito, N'Consumida', SYSUTCDATETIME(), 2 * @Precio, 0, 2 * @Precio, @IDDireccion, N'Prueba', N'Prueba', N'0');
    SET @IDReserva = SCOPE_IDENTITY();
    INSERT INTO dbo.Pedidos (IDUsuario, IDReserva, Estado, Subtotal, Descuento, Total, IVA, IDDireccion, Direccion, Ciudad, Telefono, ReferenciaPago)
    VALUES (@IDUsuario, @IDReserva, @Estado, 2 * @Precio, 0, 2 * @Precio, 0, @IDDireccion, N'Prueba', N'Prueba', N'0',
            N'P-' + CONVERT(NVARCHAR(36), NEWID()));
    SET @IDPedido = SCOPE_IDENTITY();
    INSERT INTO dbo.PedidoDetalle (IDPedido, IDVariante, Cantidad, PrecioUnitario, Descuento)
    VALUES (@IDPedido, @IDVariante, 2, @Precio, 0);
END;
GO

-- Intenta un cambio de estado y devuelve el número de error (0 si pasó).
CREATE PROCEDURE #Intentar
    @IDPedido INT, @EstadoNuevo NVARCHAR(20),
    @Mensajeria NVARCHAR(100) = NULL, @Guia NVARCHAR(60) = NULL, @PesoKg DECIMAL(8,2) = NULL,
    @CostoRecogida DECIMAL(12,2) = NULL, @RecibidoPor NVARCHAR(150) = NULL,
    @Error INT OUTPUT
AS
BEGIN
    DECLARE @Operador INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'operador@shopcart.test');
    DECLARE @Abiertas INT = @@TRANCOUNT;
    SET @Error = 0;
    BEGIN TRY
        EXEC dbo.SP_Pedidos_CambiarEstado @IDUsuario = @Operador, @IDPedido = @IDPedido, @EstadoNuevo = @EstadoNuevo,
            @Mensajeria = @Mensajeria, @Guia = @Guia, @PesoKg = @PesoKg, @CostoRecogida = @CostoRecogida, @RecibidoPor = @RecibidoPor;
    END TRY
    BEGIN CATCH
        SET @Error = ERROR_NUMBER();
        -- El SP deshizo también la transacción del caso; se abre otra para salir con el
        -- mismo contador con el que se entró, y el caso la deshace.
        IF @Abiertas > 0 AND @@TRANCOUNT = 0 BEGIN TRANSACTION;
    END CATCH;
END;
GO

-- Caso 1: despachar sin cada uno de los datos, o con datos inválidos, responde 52400.
DECLARE @ID INT, @Error INT, @Caso INT = 1;
WHILE @Caso <= 7
BEGIN
    BEGIN TRANSACTION;
    EXEC #PedidoDePrueba N'EnPreparacion', @ID OUTPUT;
    IF @Caso = 1 EXEC #Intentar @ID, N'Despachado', @Error = @Error OUTPUT;
    IF @Caso = 2 EXEC #Intentar @ID, N'Despachado', NULL, N'G1', 1, 1, @Error = @Error OUTPUT;
    IF @Caso = 3 EXEC #Intentar @ID, N'Despachado', N'M', N'   ', 1, 1, @Error = @Error OUTPUT;
    IF @Caso = 4 EXEC #Intentar @ID, N'Despachado', N'M', N'G1', NULL, 1, @Error = @Error OUTPUT;
    IF @Caso = 5 EXEC #Intentar @ID, N'Despachado', N'M', N'G1', 0, 1, @Error = @Error OUTPUT;
    IF @Caso = 6 EXEC #Intentar @ID, N'Despachado', N'M', N'G1', 1, NULL, @Error = @Error OUTPUT;
    IF @Caso = 7 EXEC #Intentar @ID, N'Despachado', N'M', N'G1', 1, -1, @Error = @Error OUTPUT;
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    IF @Error <> 52400 THROW 50000, N'FALLO: se despachó un pedido sin los datos completos.', 1;
    SET @Caso += 1;
END;
PRINT N'OK: despachar sin datos válidos rechazado (52400)';
GO

-- Caso 2: despachar con los datos guarda la fila y avanza el estado.
DECLARE @ID INT, @Error INT, @Estado NVARCHAR(20), @Filas INT;
BEGIN TRANSACTION;
EXEC #PedidoDePrueba N'EnPreparacion', @ID OUTPUT;
EXEC #Intentar @ID, N'Despachado', N' Mensajería ', N'G1', 1.5, 0, @Error = @Error OUTPUT;
SET @Estado = (SELECT Estado FROM dbo.Pedidos WHERE IDPedido = @ID);
SET @Filas = (SELECT COUNT(*) FROM dbo.PedidoEnvios
              WHERE IDPedido = @ID AND Mensajeria = N'Mensajería' AND Guia = N'G1' AND PesoKg = 1.5 AND CostoRecogida = 0
                AND RecibidoPor IS NULL AND FechaEntrega IS NULL);
ROLLBACK TRANSACTION;
IF @Error <> 0 OR @Estado <> N'Despachado' OR @Filas <> 1 THROW 50000, N'FALLO: el despacho no guardó sus datos.', 1;
PRINT N'OK: despachar con datos guarda PedidoEnvios';
GO

-- Caso 3: entregar sin quién recibió responde 52400.
DECLARE @ID INT, @Error INT;
BEGIN TRANSACTION;
EXEC #PedidoDePrueba N'EnPreparacion', @ID OUTPUT;
EXEC #Intentar @ID, N'Despachado', N'M', N'G1', 1, 1, @Error = @Error OUTPUT;
EXEC #Intentar @ID, N'Entregado', @RecibidoPor = N'  ', @Error = @Error OUTPUT;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
IF @Error <> 52400 THROW 50000, N'FALLO: se entregó un pedido sin indicar quién recibió.', 1;
PRINT N'OK: entregar sin quién recibió rechazado (52400)';
GO

-- Caso 4: entregar guarda quién recibió y la fecha.
DECLARE @ID INT, @Error INT, @Estado NVARCHAR(20), @Filas INT;
BEGIN TRANSACTION;
EXEC #PedidoDePrueba N'EnPreparacion', @ID OUTPUT;
EXEC #Intentar @ID, N'Despachado', N'M', N'G1', 1, 1, @Error = @Error OUTPUT;
EXEC #Intentar @ID, N'Entregado', @RecibidoPor = N'Ana', @Error = @Error OUTPUT;
SET @Estado = (SELECT Estado FROM dbo.Pedidos WHERE IDPedido = @ID);
SET @Filas = (SELECT COUNT(*) FROM dbo.PedidoEnvios WHERE IDPedido = @ID AND RecibidoPor = N'Ana' AND FechaEntrega IS NOT NULL);
ROLLBACK TRANSACTION;
IF @Error <> 0 OR @Estado <> N'Entregado' OR @Filas <> 1 THROW 50000, N'FALLO: la entrega no guardó sus datos.', 1;
PRINT N'OK: entregar guarda quién recibió y la fecha';
GO

-- Caso 5: entregar un pedido sin fila de despacho se rechaza.
DECLARE @ID INT, @Error INT;
BEGIN TRANSACTION;
EXEC #PedidoDePrueba N'Despachado', @ID OUTPUT;
EXEC #Intentar @ID, N'Entregado', @RecibidoPor = N'Ana', @Error = @Error OUTPUT;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
IF @Error <> 52409 THROW 50000, N'FALLO: se entregó un pedido sin datos de despacho.', 1;
PRINT N'OK: entregar sin datos de despacho rechazado (52409)';
GO

-- Caso 6: la transición inválida se rechaza antes que la falta de datos.
DECLARE @ID INT, @Error INT;
BEGIN TRANSACTION;
EXEC #PedidoDePrueba N'Pagado', @ID OUTPUT;
EXEC #Intentar @ID, N'Despachado', @Error = @Error OUTPUT;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
IF @Error <> 52409 THROW 50000, N'FALLO: la transición Pagado -> Despachado no se rechazó.', 1;
PRINT N'OK: Pagado -> Despachado rechazado (52409)';
GO

-- Caso 7: cancelar y avanzar a EnPreparacion no necesitan datos ni crean envío.
DECLARE @ID INT, @Error INT, @Error2 INT, @Filas INT;
BEGIN TRANSACTION;
EXEC #PedidoDePrueba N'Pagado', @ID OUTPUT;
EXEC #Intentar @ID, N'EnPreparacion', @Error = @Error OUTPUT;
EXEC #Intentar @ID, N'Cancelado', @Error = @Error2 OUTPUT;
SET @Filas = (SELECT COUNT(*) FROM dbo.PedidoEnvios WHERE IDPedido = @ID);
ROLLBACK TRANSACTION;
IF @Error <> 0 OR @Error2 <> 0 OR @Filas <> 0 THROW 50000, N'FALLO: otra transición exigió o creó datos de envío.', 1;
PRINT N'OK: las demás transiciones no usan PedidoEnvios';
GO

-- Caso 8: las restricciones de la tabla rechazan peso cero y costo negativo.
DECLARE @ID INT, @Error1 INT, @Error2 INT;
BEGIN TRANSACTION;
EXEC #PedidoDePrueba N'Despachado', @ID OUTPUT;
BEGIN TRY
    INSERT INTO dbo.PedidoEnvios (IDPedido, Mensajeria, Guia, PesoKg, CostoRecogida) VALUES (@ID, N'M', N'G', 0, 0);
END TRY
BEGIN CATCH
    SET @Error1 = ERROR_NUMBER();
END CATCH;
BEGIN TRY
    INSERT INTO dbo.PedidoEnvios (IDPedido, Mensajeria, Guia, PesoKg, CostoRecogida) VALUES (@ID, N'M', N'G', 1, -0.01);
END TRY
BEGIN CATCH
    SET @Error2 = ERROR_NUMBER();
END CATCH;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
IF ISNULL(@Error1, 0) <> 547 OR ISNULL(@Error2, 0) <> 547 THROW 50000, N'FALLO: PedidoEnvios aceptó peso cero o costo negativo.', 1;
PRINT N'OK: CHECK de peso y costo (547)';
GO

-- Caso 9: si falla la escritura del envío, el estado y el historial no cambian. Esta vez
-- sin transacción exterior, porque el SP la desharía. Una fila previa provoca el error.
DECLARE @ID INT, @Error INT, @Estado NVARCHAR(20), @Historial INT;
EXEC #PedidoDePrueba N'EnPreparacion', @ID OUTPUT;
INSERT INTO dbo.PedidoEnvios (IDPedido, Mensajeria, Guia, PesoKg, CostoRecogida) VALUES (@ID, N'Previa', N'G0', 1, 1);
EXEC #Intentar @ID, N'Despachado', N'M', N'G1', 1, 1, @Error = @Error OUTPUT;
SET @Estado = (SELECT Estado FROM dbo.Pedidos WHERE IDPedido = @ID);
SET @Historial = (SELECT COUNT(*) FROM dbo.PedidoHistorial WHERE IDPedido = @ID);

DECLARE @IDReserva INT, @IDCarrito INT, @IDDireccion INT;
SELECT @IDReserva = p.IDReserva, @IDCarrito = r.IDCarrito, @IDDireccion = p.IDDireccion
FROM dbo.Pedidos p JOIN dbo.Reservas r ON r.IDReserva = p.IDReserva WHERE p.IDPedido = @ID;
DELETE FROM dbo.PedidoEnvios WHERE IDPedido = @ID;
DELETE FROM dbo.PedidoHistorial WHERE IDPedido = @ID;
DELETE FROM dbo.PedidoDetalle WHERE IDPedido = @ID;
DELETE FROM dbo.Pedidos WHERE IDPedido = @ID;
DELETE FROM dbo.Reservas WHERE IDReserva = @IDReserva;
DELETE FROM dbo.Carritos WHERE IDCarrito = @IDCarrito;
DELETE FROM dbo.Direcciones WHERE IDDireccion = @IDDireccion;

IF @Error <> 2627 OR @Estado <> N'EnPreparacion' OR @Historial <> 0
    THROW 50000, N'FALLO: el cambio de estado no se deshizo junto con el envío.', 1;
PRINT N'OK: estado, historial y envío se escriben en la misma transacción';
GO

-- Caso 10: ningún pedido desde Despachado se queda sin su fila de envío.
IF EXISTS (SELECT 1 FROM dbo.Pedidos p
           WHERE p.Estado IN (N'Despachado', N'Entregado', N'DevueltoParcial', N'Devuelto')
             AND NOT EXISTS (SELECT 1 FROM dbo.PedidoEnvios e WHERE e.IDPedido = p.IDPedido))
    THROW 50000, N'FALLO: hay pedidos despachados sin fila en PedidoEnvios.', 1;
PRINT N'OK: los pedidos despachados tienen su envío';
GO

DROP PROCEDURE #Intentar;
DROP PROCEDURE #PedidoDePrueba;
GO
