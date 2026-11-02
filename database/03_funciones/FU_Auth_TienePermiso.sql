-- Indica si un usuario activo tiene un permiso. El Administrador tiene todos y un rol
-- inactivo ninguno. Tener modulo.gestionar incluye modulo.ver: las escrituras también
-- devuelven los datos.
CREATE OR ALTER FUNCTION dbo.FU_Auth_TienePermiso (@IDUsuario INT, @Codigo NVARCHAR(50))
RETURNS BIT
AS
BEGIN
    DECLARE @Rol NVARCHAR(20) = dbo.FU_Auth_Rol(@IDUsuario);
    IF @Rol IS NULL RETURN 0;
    IF @Rol = N'Administrador' RETURN 1;

    RETURN CASE WHEN EXISTS (
        SELECT 1
        FROM dbo.Roles r
        JOIN dbo.RolPermisos rp ON rp.IDRol = r.IDRol
        JOIN dbo.Permisos p ON p.IDPermiso = rp.IDPermiso
        WHERE r.Nombre = @Rol AND r.Activo = 1
          AND p.Codigo IN (@Codigo, REPLACE(@Codigo, N'.ver', N'.gestionar'))
    ) THEN 1 ELSE 0 END;
END;
GO
