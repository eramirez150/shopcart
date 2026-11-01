-- Prueba de bitácora inmutable: ni siquiera un usuario con permisos sobre la tabla
-- (por ejemplo sa) puede modificar o eliminar filas, porque el trigger
-- TR_Bitacora_Inmutable lo rechaza con el error 51403. Las inserciones sí pasan.
-- shopcart_app ni siquiera tiene permiso sobre la tabla (ver permisos.sql).
-- Uso: sqlcmd -S <servidor> -d ShopCart -I -b -i database/pruebas/bitacora.sql
SET NOCOUNT ON;
SET XACT_ABORT OFF;

DECLARE @Filas INT = (SELECT COUNT(*) FROM dbo.Bitacora);
DECLARE @ID INT = (SELECT MIN(IDBitacora) FROM dbo.Bitacora);
DECLARE @Antes NVARCHAR(MAX) = (SELECT ValorNuevo FROM dbo.Bitacora WHERE IDBitacora = @ID);
DECLARE @Error INT;

IF @ID IS NULL THROW 50000, N'FALLO: la bitácora está vacía; aplique las semillas antes de la prueba.', 1;

BEGIN TRY
    UPDATE dbo.Bitacora SET ValorNuevo = N'{"alterado":true}' WHERE IDBitacora = @ID;
END TRY
BEGIN CATCH
    SET @Error = ERROR_NUMBER();
END CATCH;
IF ISNULL(@Error, 0) <> 51403 THROW 50000, N'FALLO: se pudo modificar la bitácora.', 1;
IF ISNULL((SELECT ValorNuevo FROM dbo.Bitacora WHERE IDBitacora = @ID), N'') <> ISNULL(@Antes, N'')
    THROW 50000, N'FALLO: el valor de la bitácora cambió.', 1;
PRINT N'OK: UPDATE sobre la bitácora rechazado (51403)';

SET @Error = NULL;
BEGIN TRY
    DELETE FROM dbo.Bitacora WHERE IDBitacora = @ID;
END TRY
BEGIN CATCH
    SET @Error = ERROR_NUMBER();
END CATCH;
IF ISNULL(@Error, 0) <> 51403 THROW 50000, N'FALLO: se pudo eliminar una fila de la bitácora.', 1;

SET @Error = NULL;
BEGIN TRY
    DELETE FROM dbo.Bitacora;
END TRY
BEGIN CATCH
    SET @Error = ERROR_NUMBER();
END CATCH;
IF ISNULL(@Error, 0) <> 51403 OR (SELECT COUNT(*) FROM dbo.Bitacora) <> @Filas
    THROW 50000, N'FALLO: se pudo vaciar la bitácora.', 1;
PRINT N'OK: DELETE sobre la bitácora rechazado (51403) y no se perdió ninguna fila';
GO
