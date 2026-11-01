CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Eliminar
    @IDUsuario     INT = NULL,
    @TokenInvitado UNIQUEIDENTIFIER = NULL,
    @IDVariante    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCarrito INT;
    EXEC dbo.SP_Carrito_Resolver @IDUsuario = @IDUsuario, @TokenInvitado = @TokenInvitado, @Crear = 0, @IDCarrito = @IDCarrito OUTPUT;
    IF @IDCarrito IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante)
        THROW 52404, N'El producto no está en el carrito.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        EXEC dbo.SP_Carrito_FijarCantidad @IDCarrito = @IDCarrito, @IDVariante = @IDVariante, @Cantidad = 0, @Sumar = 0;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
    EXEC dbo.SP_Carrito_Consultar @IDCarrito = @IDCarrito;
END;
GO
