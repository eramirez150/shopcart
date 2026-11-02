-- Crea un rol con sus permisos. Un nombre repetido responde 409 por la restricción única.
CREATE OR ALTER PROCEDURE dbo.SP_Roles_Crear
    @IDUsuario   INT,
    @Nombre      NVARCHAR(20),
    @Descripcion NVARCHAR(200) = NULL,
    @Permisos    NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'roles.gestionar') = 0
        THROW 52403, N'No tiene permiso para gestionar roles.', 1;

    DECLARE @IDRol INT;

    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

        INSERT INTO dbo.Roles (Nombre, Descripcion) VALUES (@Nombre, @Descripcion);
        SET @IDRol = SCOPE_IDENTITY();

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
