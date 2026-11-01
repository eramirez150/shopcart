-- Rotación: el token recibido se revoca y se crea uno nuevo, en una transacción.
-- Si llega un token ya revocado se asume robo: se revocan todos los del usuario.
-- La revocación se confirma antes de devolver el error, por eso el THROW va al final.
CREATE OR ALTER PROCEDURE dbo.SP_Auth_RotarRefresh
    @TokenHash      CHAR(64),
    @NuevoTokenHash CHAR(64),
    @NuevaExpira    DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDUsuario INT, @Expira DATETIME2(0), @Revocado DATETIME2(0), @Mensaje NVARCHAR(200) = NULL;

    BEGIN TRANSACTION;

    SELECT @IDUsuario = IDUsuario, @Expira = Expira, @Revocado = FechaRevocado
    FROM dbo.RefreshTokens WITH (UPDLOCK, HOLDLOCK)
    WHERE TokenHash = @TokenHash;

    IF @IDUsuario IS NULL
        SET @Mensaje = N'Refresh token inválido.';
    ELSE IF @Revocado IS NOT NULL
    BEGIN
        UPDATE dbo.RefreshTokens SET FechaRevocado = SYSUTCDATETIME()
        WHERE IDUsuario = @IDUsuario AND FechaRevocado IS NULL;
        SET @Mensaje = N'Refresh token reutilizado: se cerraron las sesiones del usuario.';
    END
    ELSE IF @Expira <= SYSUTCDATETIME()
        SET @Mensaje = N'Refresh token vencido.';
    ELSE IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE IDUsuario = @IDUsuario AND Activo = 1)
        SET @Mensaje = N'El usuario está desactivado.';
    ELSE
    BEGIN
        UPDATE dbo.RefreshTokens SET FechaRevocado = SYSUTCDATETIME() WHERE TokenHash = @TokenHash;
        INSERT INTO dbo.RefreshTokens (IDUsuario, TokenHash, Expira) VALUES (@IDUsuario, @NuevoTokenHash, @NuevaExpira);
    END;

    COMMIT TRANSACTION;

    IF @Mensaje IS NOT NULL THROW 52401, @Mensaje, 1;

    SELECT IDUsuario, Correo, Nombre, Rol FROM dbo.Usuarios WHERE IDUsuario = @IDUsuario;
END;
GO
