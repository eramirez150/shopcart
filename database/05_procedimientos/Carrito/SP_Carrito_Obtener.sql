CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Obtener
    @IDUsuario     INT = NULL,
    @TokenInvitado UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IDCarrito INT;
    EXEC dbo.SP_Carrito_Resolver @IDUsuario = @IDUsuario, @TokenInvitado = @TokenInvitado, @Crear = 1, @IDCarrito = @IDCarrito OUTPUT;
    EXEC dbo.SP_Carrito_Consultar @IDCarrito = @IDCarrito;
END;
GO
