-- Deja al rol con exactamente los permisos de @Permisos, un arreglo JSON de códigos:
-- ["pedidos.ver", "cupones.gestionar"]. Solo cambia las diferencias, así la bitácora
-- registra lo que realmente cambió. Rechaza un permiso no asignable: roles.gestionar
-- nunca sale del Administrador, lo que impide escalar privilegios desde un rol editable.
-- Lo llaman SP_Roles_Crear y SP_Roles_Actualizar dentro de su transacción.
CREATE OR ALTER PROCEDURE dbo.SP_Roles_FijarPermisos
    @IDRol    INT,
    @Permisos NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    IF ISJSON(@Permisos) <> 1 THROW 52400, N'Los permisos deben ser un arreglo JSON.', 1;

    DECLARE @Pedidos TABLE (Codigo NVARCHAR(50) PRIMARY KEY);
    INSERT INTO @Pedidos (Codigo) SELECT DISTINCT value FROM OPENJSON(@Permisos);

    IF EXISTS (SELECT 1 FROM @Pedidos x WHERE NOT EXISTS (SELECT 1 FROM dbo.Permisos p WHERE p.Codigo = x.Codigo))
        THROW 52400, N'Hay un permiso que no existe en el catálogo.', 1;
    IF EXISTS (SELECT 1 FROM @Pedidos x JOIN dbo.Permisos p ON p.Codigo = x.Codigo WHERE p.Asignable = 0)
        THROW 52400, N'El permiso roles.gestionar es exclusivo del Administrador.', 1;

    DELETE rp
    FROM dbo.RolPermisos rp
    JOIN dbo.Permisos p ON p.IDPermiso = rp.IDPermiso
    WHERE rp.IDRol = @IDRol AND p.Codigo NOT IN (SELECT Codigo FROM @Pedidos);

    INSERT INTO dbo.RolPermisos (IDRol, IDPermiso)
    SELECT @IDRol, p.IDPermiso
    FROM dbo.Permisos p
    JOIN @Pedidos x ON x.Codigo = p.Codigo
    WHERE NOT EXISTS (SELECT 1 FROM dbo.RolPermisos rp WHERE rp.IDRol = @IDRol AND rp.IDPermiso = p.IDPermiso);
END;
GO
