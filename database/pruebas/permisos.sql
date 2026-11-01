-- Prueba manual de permisos: un usuario con el rol de la aplicación solo puede
-- ejecutar stored procedures. No es un script numerado: aplicar.sh no lo ejecuta.
-- Uso: sqlcmd -S <servidor> -d ShopCart -I -b -i database/pruebas/permisos.sql
-- Crea un usuario temporal sin inicio de sesión y lo elimina al terminar.
SET NOCOUNT ON;
CREATE USER prueba_permisos WITHOUT LOGIN;
ALTER ROLE RolShopCartApp ADD MEMBER prueba_permisos;

EXECUTE AS USER = 'prueba_permisos';
BEGIN TRY SELECT TOP (1) * FROM dbo.Usuarios; PRINT 'FALLO: pudo leer Usuarios'; END TRY
BEGIN CATCH PRINT 'OK: SELECT directo denegado (' + CAST(ERROR_NUMBER() AS VARCHAR(10)) + ')'; END CATCH;
BEGIN TRY UPDATE dbo.Variantes SET Precio = 0; PRINT 'FALLO: pudo actualizar Variantes'; END TRY
BEGIN CATCH PRINT 'OK: UPDATE directo denegado (' + CAST(ERROR_NUMBER() AS VARCHAR(10)) + ')'; END CATCH;
BEGIN TRY DELETE FROM dbo.Bitacora; PRINT 'FALLO: pudo borrar la bitácora'; END TRY
BEGIN CATCH PRINT 'OK: DELETE directo sobre la bitácora denegado (' + CAST(ERROR_NUMBER() AS VARCHAR(10)) + ')'; END CATCH;
BEGIN TRY EXEC dbo.SP_Categorias_Listar; PRINT 'OK: EXECUTE de un SP permitido'; END TRY
BEGIN CATCH PRINT 'FALLO: no pudo ejecutar un SP'; END CATCH;
REVERT;

ALTER ROLE RolShopCartApp DROP MEMBER prueba_permisos;
DROP USER prueba_permisos;
