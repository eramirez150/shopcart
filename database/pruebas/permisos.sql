-- Prueba de permisos: un usuario con el rol de la aplicación solo puede ejecutar
-- stored procedures. Crea un usuario temporal sin inicio de sesión y lo elimina al
-- terminar. Ante un fallo el script se detiene con error.
-- Uso: sqlcmd -S <servidor> -d ShopCart -I -b -i database/pruebas/permisos.sql
SET NOCOUNT ON;
IF DATABASE_PRINCIPAL_ID(N'prueba_permisos') IS NOT NULL DROP USER prueba_permisos;
CREATE USER prueba_permisos WITHOUT LOGIN;
ALTER ROLE RolShopCartApp ADD MEMBER prueba_permisos;
GO

DECLARE @Fallos NVARCHAR(1000) = N'';

EXECUTE AS USER = 'prueba_permisos';
BEGIN TRY SELECT TOP (1) IDUsuario FROM dbo.Usuarios; SET @Fallos += N' pudo leer Usuarios;'; END TRY
BEGIN CATCH PRINT N'OK: SELECT directo denegado (' + CAST(ERROR_NUMBER() AS NVARCHAR(10)) + N')'; END CATCH;
BEGIN TRY UPDATE dbo.Variantes SET Precio = Precio WHERE 1 = 0; SET @Fallos += N' pudo actualizar Variantes;'; END TRY
BEGIN CATCH PRINT N'OK: UPDATE directo denegado (' + CAST(ERROR_NUMBER() AS NVARCHAR(10)) + N')'; END CATCH;
BEGIN TRY DELETE FROM dbo.Bitacora WHERE 1 = 0; SET @Fallos += N' pudo borrar la bitácora;'; END TRY
BEGIN CATCH PRINT N'OK: DELETE directo sobre la bitácora denegado (' + CAST(ERROR_NUMBER() AS NVARCHAR(10)) + N')'; END CATCH;
BEGIN TRY SELECT TOP (1) IDResena FROM dbo.Resenas; SET @Fallos += N' pudo leer Resenas;'; END TRY
BEGIN CATCH PRINT N'OK: SELECT directo sobre las reseñas denegado (' + CAST(ERROR_NUMBER() AS NVARCHAR(10)) + N')'; END CATCH;
BEGIN TRY SELECT TOP (1) IDRol FROM dbo.Roles; SET @Fallos += N' pudo leer Roles;'; END TRY
BEGIN CATCH PRINT N'OK: SELECT directo sobre Roles denegado (' + CAST(ERROR_NUMBER() AS NVARCHAR(10)) + N')'; END CATCH;
BEGIN TRY DELETE FROM dbo.RolPermisos WHERE 1 = 0; SET @Fallos += N' pudo borrar RolPermisos;'; END TRY
BEGIN CATCH PRINT N'OK: DELETE directo sobre RolPermisos denegado (' + CAST(ERROR_NUMBER() AS NVARCHAR(10)) + N')'; END CATCH;
BEGIN TRY EXEC dbo.SP_Categorias_Listar; PRINT N'OK: EXECUTE de un SP permitido'; END TRY
BEGIN CATCH SET @Fallos += N' no pudo ejecutar un SP;'; END CATCH;
REVERT;

ALTER ROLE RolShopCartApp DROP MEMBER prueba_permisos;
DROP USER prueba_permisos;

IF @Fallos <> N'' BEGIN SET @Fallos = N'FALLO:' + @Fallos; THROW 50000, @Fallos, 1; END;
GO

-- Permisos por rol con FU_Auth_TienePermiso, sobre los usuarios de las semillas.
DECLARE @Admin INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'admin@shopcart.test');
DECLARE @Operador INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'operador@shopcart.test');
DECLARE @Cliente INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'cliente@shopcart.test');

IF EXISTS (SELECT 1 FROM dbo.Permisos WHERE dbo.FU_Auth_TienePermiso(@Admin, Codigo) = 0)
    THROW 50000, N'FALLO: al Administrador le falta un permiso.', 1;
PRINT N'OK: el Administrador tiene todos los permisos';

IF EXISTS (SELECT 1 FROM dbo.Permisos WHERE dbo.FU_Auth_TienePermiso(@Cliente, Codigo) = 1)
    THROW 50000, N'FALLO: el Cliente tiene un permiso de personal.', 1;
PRINT N'OK: el Cliente no tiene permisos de personal';

IF dbo.FU_Auth_TienePermiso(@Operador, N'pedidos.ver') = 0 OR dbo.FU_Auth_TienePermiso(@Operador, N'inventario.gestionar') = 0
    OR dbo.FU_Auth_TienePermiso(@Operador, N'cupones.gestionar') = 1 OR dbo.FU_Auth_TienePermiso(@Operador, N'roles.gestionar') = 1
    THROW 50000, N'FALLO: el Operador no conserva su acceso.', 1;
PRINT N'OK: el Operador conserva pedidos e inventario y nada más';

IF EXISTS (SELECT 1 FROM dbo.RolPermisos rp JOIN dbo.Permisos p ON p.IDPermiso = rp.IDPermiso WHERE p.Asignable = 0)
    THROW 50000, N'FALLO: un rol tiene un permiso no asignable.', 1;
PRINT N'OK: ningún rol tiene roles.gestionar en RolPermisos';

DECLARE @Error INT = 0;
BEGIN TRY
    EXEC dbo.SP_Roles_ListarPermisos @IDUsuario = @Operador;
END TRY
BEGIN CATCH
    SET @Error = ERROR_NUMBER();
END CATCH;
IF @Error <> 52403 THROW 50000, N'FALLO: el Operador pudo consultar los permisos.', 1;
PRINT N'OK: el SP rechaza al Operador en la gestión de roles (52403)';
GO
