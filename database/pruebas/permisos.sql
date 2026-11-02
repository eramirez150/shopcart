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
BEGIN TRY EXEC dbo.SP_Categorias_Listar; PRINT N'OK: EXECUTE de un SP permitido'; END TRY
BEGIN CATCH SET @Fallos += N' no pudo ejecutar un SP;'; END CATCH;
REVERT;

ALTER ROLE RolShopCartApp DROP MEMBER prueba_permisos;
DROP USER prueba_permisos;

IF @Fallos <> N'' BEGIN SET @Fallos = N'FALLO:' + @Fallos; THROW 50000, @Fallos, 1; END;
GO
