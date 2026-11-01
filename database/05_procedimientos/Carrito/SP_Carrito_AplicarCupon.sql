-- Un cupón por pedido: aplicar uno nuevo reemplaza al anterior.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_AplicarCupon
    @IDUsuario     INT = NULL,
    @TokenInvitado UNIQUEIDENTIFIER = NULL,
    @Codigo        NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- El cupón tiene límite por cliente, por lo que exige una cuenta.
    IF @IDUsuario IS NULL THROW 52401, N'Inicie sesión para aplicar un cupón.', 1;

    DECLARE @IDCarrito INT, @IDCupon INT;
    EXEC dbo.SP_Carrito_Resolver @IDUsuario = @IDUsuario, @TokenInvitado = NULL, @Crear = 1, @IDCarrito = @IDCarrito OUTPUT;
    EXEC dbo.SP_Cupones_Validar @IDUsuario = @IDUsuario, @IDCarrito = @IDCarrito, @Codigo = @Codigo, @IDCupon = @IDCupon OUTPUT;

    BEGIN TRANSACTION;
    UPDATE dbo.Reservas SET Estado = N'Anulada' WHERE IDCarrito = @IDCarrito AND Estado = N'Activa';
    UPDATE dbo.Carritos SET IDCupon = @IDCupon, FechaActualizacion = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;
    COMMIT TRANSACTION;

    EXEC dbo.SP_Carrito_Consultar @IDCarrito = @IDCarrito;
END;
GO
