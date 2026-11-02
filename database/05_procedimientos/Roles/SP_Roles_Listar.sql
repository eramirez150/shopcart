-- Roles con sus permisos, o uno solo con @IDRol. Dos resultados: los roles y los pares
-- rol-permiso. El Administrador aparece con todo el catálogo porque lo tiene sin filas
-- en RolPermisos.
CREATE OR ALTER PROCEDURE dbo.SP_Roles_Listar
    @IDUsuario INT,
    @IDRol     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'roles.gestionar') = 0
        THROW 52403, N'No tiene permiso para gestionar roles.', 1;
    IF @IDRol IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE IDRol = @IDRol)
        THROW 52404, N'El rol no existe.', 1;

    SELECT r.IDRol, r.Nombre, r.Descripcion, r.EsSistema, r.Activo, r.FechaCreacion,
           (SELECT COUNT(*) FROM dbo.Usuarios u WHERE u.Rol = r.Nombre AND u.Activo = 1) AS UsuariosActivos
    FROM dbo.Roles r
    WHERE @IDRol IS NULL OR r.IDRol = @IDRol
    ORDER BY r.IDRol;

    SELECT r.IDRol, p.Codigo
    FROM dbo.Roles r
    CROSS JOIN dbo.Permisos p
    WHERE (@IDRol IS NULL OR r.IDRol = @IDRol)
      AND (r.Nombre = N'Administrador'
           OR EXISTS (SELECT 1 FROM dbo.RolPermisos rp WHERE rp.IDRol = r.IDRol AND rp.IDPermiso = p.IDPermiso))
    ORDER BY r.IDRol, p.Codigo;
END;
GO
