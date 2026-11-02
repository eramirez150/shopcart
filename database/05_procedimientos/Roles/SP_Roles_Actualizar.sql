-- Modifica un rol y reemplaza sus permisos. Un rol no se borra: se desactiva con
-- @Activo = 0, siempre que no tenga usuarios activos. Los roles de sistema no se tocan.
CREATE OR ALTER PROCEDURE dbo.SP_Roles_Actualizar
    @IDUsuario   INT,
    @IDRol       INT,
    @Nombre      NVARCHAR(20),
    @Descripcion NVARCHAR(200) = NULL,
    @Activo      BIT = 1,
    @Permisos    NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'roles.gestionar') = 0
        THROW 52403, N'No tiene permiso para gestionar roles.', 1;

    DECLARE @EsSistema BIT, @NombreActual NVARCHAR(20);
    SELECT @EsSistema = EsSistema, @NombreActual = Nombre FROM dbo.Roles WHERE IDRol = @IDRol;

    IF @EsSistema IS NULL THROW 52404, N'El rol no existe.', 1;
    IF @EsSistema = 1 THROW 52409, N'Un rol de sistema no se puede modificar ni desactivar.', 1;
    IF @Activo = 0 AND EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Rol = @NombreActual AND Activo = 1)
        THROW 52409, N'El rol tiene usuarios activos: reasígnelos antes de desactivarlo.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

        UPDATE dbo.Roles SET Nombre = @Nombre, Descripcion = @Descripcion, Activo = @Activo
        WHERE IDRol = @IDRol;

        EXEC dbo.SP_Roles_FijarPermisos @IDRol = @IDRol, @Permisos = @Permisos;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Roles_Listar @IDUsuario = @IDUsuario, @IDRol = @IDRol;
END;
GO
