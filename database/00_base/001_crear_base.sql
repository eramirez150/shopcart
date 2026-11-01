-- Crea la base de datos si no existe. Se ejecuta conectado a master y fuera de
-- una transacción (CREATE DATABASE no se permite dentro de una).
-- El nombre llega en la variable de sqlcmd DB_NAME:
--   sqlcmd -S <servidor> -d master -v DB_NAME=ShopCart -i database/00_base/001_crear_base.sql
-- En SSMS: activar el modo SQLCMD (menú Consulta) y agregar antes `:setvar DB_NAME ShopCart`.
-- aplicar.sh lo ejecuta primero, con el valor de la variable de entorno DB_NAME.
IF DB_ID(N'$(DB_NAME)') IS NULL
    CREATE DATABASE [$(DB_NAME)];
GO
