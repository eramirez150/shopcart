-- Cambia el rol o el estado activo de un usuario. Nunca se borra. Al desactivarlo o
-- cambiarle el rol se cierran sus sesiones. Nadie cambia su propio rol ni se desactiva,
-- y solo el Administrador cambia roles o modifica a otro administrador.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Actualizar
    @IDUsuario  INT,
    @IDObjetivo INT,
    @Rol        NVARCHAR(20) = NULL,
    @Activo     BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'usuarios.gestionar') = 0
        THROW 52403, N'No tiene permiso para gestionar usuarios.', 1;

    IF @Rol IS NOT NULL
    BEGIN
        SET @Rol = (SELECT Nombre FROM dbo.Roles WHERE Nombre = @Rol AND Activo = 1);
        IF @Rol IS NULL THROW 52400, N'Rol inválido o inactivo.', 1;
    END;

    DECLARE @RolActual NVARCHAR(20) = (SELECT Rol FROM dbo.Usuarios WHERE IDUsuario = @IDObjetivo);

    IF @IDUsuario = @IDObjetivo AND (@Activo = 0 OR @Rol <> @RolActual)
        THROW 52409, N'Un usuario no puede cambiar su propio rol ni desactivarse.', 1;
    IF @RolActual IS NULL
        THROW 52404, N'El usuario no existe.', 1;
    IF (@Rol <> @RolActual OR @RolActual = N'Administrador') AND dbo.FU_Auth_TienePermiso(@IDUsuario, N'roles.gestionar') = 0
        THROW 52403, N'Solo el Administrador cambia roles o modifica a un administrador.', 1;
    IF @Activo = 1 AND @Rol IS NULL AND NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Nombre = @RolActual AND Activo = 1)
        THROW 52409, N'El rol del usuario está inactivo: asígnele otro para reactivarlo.', 1;

    BEGIN TRANSACTION;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

    UPDATE dbo.Usuarios
    SET Rol = ISNULL(@Rol, Rol), Activo = ISNULL(@Activo, Activo)
    WHERE IDUsuario = @IDObjetivo;

    IF @Activo = 0 OR @Rol <> @RolActual
        UPDATE dbo.RefreshTokens SET FechaRevocado = SYSUTCDATETIME()
        WHERE IDUsuario = @IDObjetivo AND FechaRevocado IS NULL;
    COMMIT TRANSACTION;

    SELECT IDUsuario, Correo, Nombre, Rol, Activo FROM dbo.Usuarios WHERE IDUsuario = @IDObjetivo;
END;
GO
