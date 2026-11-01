#!/bin/sh
# Aplica en orden los scripts numerados que aún no se han ejecutado.
set -eu

export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"
SQLCMD="/opt/mssql-tools18/bin/sqlcmd -S db -U sa -C -b"

$SQLCMD -Q "IF DB_ID(N'$DB_NAME') IS NULL CREATE DATABASE [$DB_NAME];"

$SQLCMD -d "$DB_NAME" -Q "
IF OBJECT_ID(N'dbo.ScriptsAplicados', N'U') IS NULL
    CREATE TABLE dbo.ScriptsAplicados (
        IDScriptAplicado INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Nombre NVARCHAR(200) NOT NULL UNIQUE,
        FechaAplicado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
    );"

for archivo in /scripts/[0-9]*.sql; do
    [ -e "$archivo" ] || continue
    nombre=$(basename "$archivo")
    aplicado=$($SQLCMD -d "$DB_NAME" -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.ScriptsAplicados WHERE Nombre = N'$nombre';" | tr -d '[:space:]')

    if [ "$aplicado" = "0" ]; then
        echo "Aplicando $nombre"
        $SQLCMD -d "$DB_NAME" -i "$archivo"
        $SQLCMD -d "$DB_NAME" -Q "INSERT INTO dbo.ScriptsAplicados (Nombre) VALUES (N'$nombre');"
    else
        echo "Omitido $nombre"
    fi
done

echo "Base de datos lista"
