-- Catálogo de permisos por módulo. Asignable = 0: ningún rol lo puede recibir.
CREATE OR ALTER PROCEDURE dbo.SP_Roles_ListarPermisos
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'roles.gestionar') = 0
        THROW 52403, N'No tiene permiso para gestionar roles.', 1;

    SELECT IDPermiso, Codigo, Modulo, Descripcion, Asignable
    FROM dbo.Permisos
    ORDER BY Modulo, Codigo;
END;
GO
