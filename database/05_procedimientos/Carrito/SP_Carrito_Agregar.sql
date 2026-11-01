CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Agregar
    @IDUsuario     INT = NULL,
    @TokenInvitado UNIQUEIDENTIFIER = NULL,
    @IDVariante    INT,
    @Cantidad      INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @Cantidad <= 0 THROW 52400, N'La cantidad debe ser mayor que cero.', 1;

    DECLARE @IDCarrito INT;
    BEGIN TRY
        BEGIN TRANSACTION;
        EXEC dbo.SP_Carrito_Resolver @IDUsuario = @IDUsuario, @TokenInvitado = @TokenInvitado, @Crear = 1, @IDCarrito = @IDCarrito OUTPUT;
        EXEC dbo.SP_Carrito_FijarCantidad @IDCarrito = @IDCarrito, @IDVariante = @IDVariante, @Cantidad = @Cantidad, @Sumar = 1;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
    EXEC dbo.SP_Carrito_Consultar @IDCarrito = @IDCarrito;
END;
GO
