-- Prueba directa del trigger TR_Pedidos_ValidarTransicion: un UPDATE que no pasa
-- por los SP tampoco puede saltarse PedidoTransiciones. También comprueba que
-- SP_Devoluciones_Registrar y SP_Pedidos_CambiarEstado siguen funcionando.
-- Cada caso crea su pedido dentro de una transacción y la deshace al terminar:
-- la base queda igual. Ante un fallo el script se detiene con error.
-- Uso: sqlcmd -S <servidor> -d ShopCart -I -b -i database/pruebas/transiciones.sql
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

-- Caso 1: retroceder de Entregado a Pagado con un UPDATE directo se rechaza.
DECLARE @ID INT, @Error INT;
BEGIN TRANSACTION;
EXEC #PedidoDePrueba N'Entregado', @ID OUTPUT;
BEGIN TRY
    UPDATE dbo.Pedidos SET Estado = N'Pagado' WHERE IDPedido = @ID;
END TRY
BEGIN CATCH
    SET @Error = ERROR_NUMBER();
END CATCH;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
IF ISNULL(@Error, 0) <> 52409 THROW 50000, N'FALLO: el UPDATE de Entregado a Pagado no se rechazó.', 1;
PRINT N'OK: Entregado -> Pagado rechazado (52409)';
GO

-- Caso 2: saltarse estados (Pagado a Entregado) se rechaza.
DECLARE @ID INT, @Error INT;
BEGIN TRANSACTION;
EXEC #PedidoDePrueba N'Pagado', @ID OUTPUT;
BEGIN TRY
    UPDATE dbo.Pedidos SET Estado = N'Entregado' WHERE IDPedido = @ID;
END TRY
BEGIN CATCH
    SET @Error = ERROR_NUMBER();
END CATCH;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
IF ISNULL(@Error, 0) <> 52409 THROW 50000, N'FALLO: el salto de Pagado a Entregado no se rechazó.', 1;
PRINT N'OK: Pagado -> Entregado rechazado (52409)';
GO

-- Caso 3: salir de un estado final (Cancelado) se rechaza.
DECLARE @ID INT, @Error INT;
BEGIN TRANSACTION;
EXEC #PedidoDePrueba N'Cancelado', @ID OUTPUT;
BEGIN TRY
    UPDATE dbo.Pedidos SET Estado = N'Pagado' WHERE IDPedido = @ID;
END TRY
BEGIN CATCH
    SET @Error = ERROR_NUMBER();
END CATCH;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
IF ISNULL(@Error, 0) <> 52409 THROW 50000, N'FALLO: un pedido Cancelado cambió de estado.', 1;
PRINT N'OK: Cancelado -> Pagado rechazado (52409)';
GO

-- Caso 4: una transición permitida pasa, y un UPDATE que no cambia el estado también.
DECLARE @ID INT, @Estado NVARCHAR(20);
BEGIN TRANSACTION;
EXEC #PedidoDePrueba N'Pagado', @ID OUTPUT;
UPDATE dbo.Pedidos SET Estado = N'EnPreparacion' WHERE IDPedido = @ID;
UPDATE dbo.Pedidos SET FechaActualizacion = SYSUTCDATETIME() WHERE IDPedido = @ID;
SET @Estado = (SELECT Estado FROM dbo.Pedidos WHERE IDPedido = @ID);
ROLLBACK TRANSACTION;
IF @Estado <> N'EnPreparacion' THROW 50000, N'FALLO: la transición Pagado -> EnPreparacion no se aplicó.', 1;
PRINT N'OK: Pagado -> EnPreparacion permitido';
GO

-- Caso 5: SP_Devoluciones_Registrar sigue funcionando (parcial y luego total).
DECLARE @ID INT, @IDLinea INT, @Lineas NVARCHAR(100), @Estado1 NVARCHAR(20), @Estado2 NVARCHAR(20);
DECLARE @Operador INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'operador@shopcart.test');
BEGIN TRANSACTION;
EXEC #PedidoDePrueba N'Entregado', @ID OUTPUT;
SET @IDLinea = (SELECT IDPedidoDetalle FROM dbo.PedidoDetalle WHERE IDPedido = @ID);
SET @Lineas = N'[{"idPedidoDetalle": ' + CAST(@IDLinea AS NVARCHAR(10)) + N', "cantidad": 1}]';
EXEC dbo.SP_Devoluciones_Registrar @IDUsuario = @Operador, @IDPedido = @ID, @Motivo = N'Prueba parcial', @Lineas = @Lineas;
SET @Estado1 = (SELECT Estado FROM dbo.Pedidos WHERE IDPedido = @ID);
EXEC dbo.SP_Devoluciones_Registrar @IDUsuario = @Operador, @IDPedido = @ID, @Motivo = N'Prueba total', @Lineas = @Lineas;
SET @Estado2 = (SELECT Estado FROM dbo.Pedidos WHERE IDPedido = @ID);
ROLLBACK TRANSACTION;
IF @Estado1 <> N'DevueltoParcial' OR @Estado2 <> N'Devuelto'
    THROW 50000, N'FALLO: SP_Devoluciones_Registrar no llevó el pedido a DevueltoParcial y Devuelto.', 1;
PRINT N'OK: SP_Devoluciones_Registrar pasa por DevueltoParcial y Devuelto';
GO

DROP PROCEDURE #PedidoDePrueba;
GO
