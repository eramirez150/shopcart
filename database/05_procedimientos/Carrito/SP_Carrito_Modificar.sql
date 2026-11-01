CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Modificar
    @IDUsuario     INT = NULL,
    @TokenInvitado UNIQUEIDENTIFIER = NULL,
    @IDVariante    INT,
    @Cantidad      INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @Cantidad <= 0 THROW 52400, N'La cantidad debe ser mayor que cero. Para quitar la línea use eliminar.', 1;

    DECLARE @IDCarrito INT;
    EXEC dbo.SP_Carrito_Resolver @IDUsuario = @IDUsuario, @TokenInvitado = @TokenInvitado, @Crear = 0, @IDCarrito = @IDCarrito OUTPUT;
    IF @IDCarrito IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante)
        THROW 52404, N'El producto no está en el carrito.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        EXEC dbo.SP_Carrito_FijarCantidad @IDCarrito = @IDCarrito, @IDVariante = @IDVariante, @Cantidad = @Cantidad, @Sumar = 0;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
    EXEC dbo.SP_Carrito_Consultar @IDCarrito = @IDCarrito;
END;
GO
