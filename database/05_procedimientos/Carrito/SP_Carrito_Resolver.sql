-- Busca el carrito abierto del usuario o del invitado; con @Crear = 1 lo crea si no existe.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Resolver
    @IDUsuario     INT = NULL,
    @TokenInvitado UNIQUEIDENTIFIER = NULL,
    @Crear         BIT = 1,
    @IDCarrito     INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @IDCarrito = NULL;

    IF @IDUsuario IS NOT NULL
        SELECT @IDCarrito = IDCarrito FROM dbo.Carritos WHERE IDUsuario = @IDUsuario AND Estado = N'Abierto';
    ELSE IF @TokenInvitado IS NOT NULL
        SELECT @IDCarrito = IDCarrito FROM dbo.Carritos
        WHERE TokenInvitado = @TokenInvitado AND IDUsuario IS NULL AND Estado = N'Abierto';
    ELSE IF @Crear = 0
        RETURN;

    IF @IDCarrito IS NULL AND @Crear = 1
    BEGIN
        IF @IDUsuario IS NOT NULL
            INSERT INTO dbo.Carritos (IDUsuario) VALUES (@IDUsuario);
        ELSE
            INSERT INTO dbo.Carritos (TokenInvitado) VALUES (NEWID());
        SET @IDCarrito = SCOPE_IDENTITY();
    END;
END;
GO
