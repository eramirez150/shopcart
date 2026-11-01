CREATE OR ALTER PROCEDURE dbo.SP_Carrito_QuitarCupon
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCarrito INT;
    EXEC dbo.SP_Carrito_Resolver @IDUsuario = @IDUsuario, @TokenInvitado = NULL, @Crear = 1, @IDCarrito = @IDCarrito OUTPUT;

    BEGIN TRANSACTION;
    UPDATE dbo.Reservas SET Estado = N'Anulada' WHERE IDCarrito = @IDCarrito AND Estado = N'Activa';
    UPDATE dbo.Carritos SET IDCupon = NULL, FechaActualizacion = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;
    COMMIT TRANSACTION;

    EXEC dbo.SP_Carrito_Consultar @IDCarrito = @IDCarrito;
END;
GO
