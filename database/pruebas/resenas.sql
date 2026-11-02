-- Prueba directa de las reseñas: SP_Resenas_Crear exige rol Cliente y un pedido Entregado
-- con el producto, y la tabla no admite una segunda reseña ni una calificación inválida.
-- Todo ocurre dentro de una transacción que se deshace al terminar: la base queda igual.
-- Uso: sqlcmd -S <servidor> -d ShopCart -I -b -i database/pruebas/resenas.sql
SET NOCOUNT ON;
GO

-- Pedido mínimo de un usuario, con una línea de la variante, en el estado indicado.
CREATE PROCEDURE #Pedido
    @IDUsuario  INT,
    @IDVariante INT,
    @Estado     NVARCHAR(20)
AS
BEGIN
    DECLARE @IDCarrito INT, @IDDireccion INT, @IDReserva INT, @IDPedido INT;
    INSERT INTO dbo.Direcciones (IDUsuario, Direccion, Ciudad, Telefono) VALUES (@IDUsuario, N'Prueba', N'Prueba', N'0');
    SET @IDDireccion = SCOPE_IDENTITY();
    INSERT INTO dbo.Carritos (IDUsuario, Estado) VALUES (@IDUsuario, N'Convertido');
    SET @IDCarrito = SCOPE_IDENTITY();
    INSERT INTO dbo.Reservas (IDUsuario, IDCarrito, Estado, Expira, Subtotal, Descuento, Total, IDDireccion, Direccion, Ciudad, Telefono)
    VALUES (@IDUsuario, @IDCarrito, N'Consumida', SYSUTCDATETIME(), 1, 0, 1, @IDDireccion, N'Prueba', N'Prueba', N'0');
    SET @IDReserva = SCOPE_IDENTITY();
    INSERT INTO dbo.Pedidos (IDUsuario, IDReserva, Estado, Subtotal, Descuento, Total, IVA, IDDireccion, Direccion, Ciudad, Telefono, ReferenciaPago)
    VALUES (@IDUsuario, @IDReserva, @Estado, 1, 0, 1, 0, @IDDireccion, N'Prueba', N'Prueba', N'0', N'P-' + CONVERT(NVARCHAR(36), NEWID()));
    SET @IDPedido = SCOPE_IDENTITY();
    INSERT INTO dbo.PedidoDetalle (IDPedido, IDVariante, Cantidad, PrecioUnitario, Descuento) VALUES (@IDPedido, @IDVariante, 1, 1, 0);
END;
GO

-- Devuelve el número del error de SP_Resenas_Crear, o 0 si creó la reseña.
CREATE PROCEDURE #Crear
    @IDUsuario  INT,
    @IDProducto INT,
    @Error      INT OUTPUT
AS
BEGIN
    SET @Error = 0;
    BEGIN TRY
        EXEC dbo.SP_Resenas_Crear @IDUsuario = @IDUsuario, @IDProducto = @IDProducto, @Calificacion = 4, @Comentario = N'Prueba';
    END TRY
    BEGIN CATCH
        SET @Error = ERROR_NUMBER();
    END CATCH;
END;
GO

DECLARE @Fallos NVARCHAR(1000) = N'', @Error INT, @Resenas INT;
DECLARE @Operador INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'operador@shopcart.test');
DECLARE @IDVariante INT, @IDProducto INT, @Cliente INT;

BEGIN TRANSACTION;
INSERT INTO dbo.Usuarios (Correo, ClaveHash, Nombre, Rol) VALUES (N'prueba-resenas@shopcart.test', N'x', N'Prueba Resenas', N'Cliente');
SET @Cliente = SCOPE_IDENTITY();
-- Una variante de un producto sin relación con el cliente nuevo.
SELECT TOP (1) @IDVariante = IDVariante, @IDProducto = IDProducto FROM dbo.Variantes ORDER BY IDVariante;

-- Caso 1: sin pedidos se rechaza.
EXEC #Crear @Cliente, @IDProducto, @Error OUTPUT;
IF @Error <> 52403 SET @Fallos += N' creó una reseña sin compra;';
ELSE PRINT N'OK: sin compra rechazada (52403)';

-- Caso 2: los pedidos que no están Entregado no cuentan.
EXEC #Pedido @Cliente, @IDVariante, N'Pagado';
EXEC #Pedido @Cliente, @IDVariante, N'Despachado';
EXEC #Pedido @Cliente, @IDVariante, N'Cancelado';
EXEC #Pedido @Cliente, @IDVariante, N'Devuelto';
EXEC #Crear @Cliente, @IDProducto, @Error OUTPUT;
IF @Error <> 52403 SET @Fallos += N' aceptó un pedido que no está Entregado;';
ELSE PRINT N'OK: pedido sin entregar rechazado (52403)';

-- Caso 3: con un pedido Entregado se crea.
EXEC #Pedido @Cliente, @IDVariante, N'Entregado';
EXEC #Crear @Cliente, @IDProducto, @Error OUTPUT;
IF @Error <> 0 SET @Fallos += N' rechazó una compra entregada;';
ELSE PRINT N'OK: compra entregada crea la reseña';

-- Caso 4: la segunda reseña se rechaza y no se agrega.
EXEC #Crear @Cliente, @IDProducto, @Error OUTPUT;
SET @Resenas = (SELECT COUNT(*) FROM dbo.Resenas WHERE IDUsuario = @Cliente);
IF @Error <> 52409 OR @Resenas <> 1 SET @Fallos += N' aceptó una segunda reseña;';
ELSE PRINT N'OK: segunda reseña rechazada (52409)';

-- Caso 5: otro rol no reseña aunque tenga el pedido.
EXEC #Pedido @Operador, @IDVariante, N'Entregado';
EXEC #Crear @Operador, @IDProducto, @Error OUTPUT;
IF @Error <> 52403 SET @Fallos += N' un Operador creó una reseña;';
ELSE PRINT N'OK: Operador rechazado (52403)';

-- Caso 6: la tabla rechaza una calificación fuera de rango aunque no pase por el SP.
SET @Error = 0;
BEGIN TRY
    INSERT INTO dbo.Resenas (IDProducto, IDUsuario, Calificacion, Comentario) VALUES (@IDProducto, @Operador, 6, N'Prueba');
END TRY
BEGIN CATCH
    SET @Error = ERROR_NUMBER();
END CATCH;
IF @Error <> 547 SET @Fallos += N' la tabla aceptó una calificación de 6;';
ELSE PRINT N'OK: calificación fuera de rango rechazada (547)';

ROLLBACK TRANSACTION;
IF @Fallos <> N'' BEGIN SET @Fallos = N'FALLO:' + @Fallos; THROW 50000, @Fallos, 1; END;
GO

DROP PROCEDURE #Pedido;
DROP PROCEDURE #Crear;
GO
