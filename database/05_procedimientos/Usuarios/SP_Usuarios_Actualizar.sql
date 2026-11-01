-- Cambia el rol o el estado activo de un usuario. Nunca se borra. Al desactivarlo
-- se cierran sus sesiones. Un administrador no puede desactivarse a sí mismo.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Actualizar
    @IDUsuario  INT,
    @IDObjetivo INT,
    @Rol        NVARCHAR(20) = NULL,
    @Activo     BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF dbo.FU_Auth_Rol(@IDUsuario) IS NULL OR dbo.FU_Auth_Rol(@IDUsuario) <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona usuarios.', 1;
    IF @Rol IS NOT NULL AND @Rol NOT IN (N'Cliente', N'Operador', N'Administrador')
        THROW 52400, N'Rol inválido.', 1;
    IF @IDUsuario = @IDObjetivo AND (@Activo = 0 OR (@Rol IS NOT NULL AND @Rol <> N'Administrador'))
        THROW 52409, N'Un administrador no puede quitarse su propio acceso.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE IDUsuario = @IDObjetivo)
        THROW 52404, N'El usuario no existe.', 1;

    BEGIN TRANSACTION;
    UPDATE dbo.Usuarios
    SET Rol = ISNULL(@Rol, Rol), Activo = ISNULL(@Activo, Activo)
    WHERE IDUsuario = @IDObjetivo;

    IF @Activo = 0
        UPDATE dbo.RefreshTokens SET FechaRevocado = SYSUTCDATETIME()
        WHERE IDUsuario = @IDObjetivo AND FechaRevocado IS NULL;
    COMMIT TRANSACTION;

    SELECT IDUsuario, Correo, Nombre, Rol, Activo FROM dbo.Usuarios WHERE IDUsuario = @IDObjetivo;
END;
GO
