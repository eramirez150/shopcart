#!/bin/sh
# Aplica en orden los scripts numerados que aún no se han ejecutado.
#
# Reglas para los scripts de esta carpeta:
# - El nombre empieza con un prefijo de tres dígitos y un guion bajo,
#   por ejemplo 001_tablas.sql. Se aplican en orden alfabético.
# - Cada script se ejecuta dentro de una transacción junto con su registro
#   en dbo.ScriptsAplicados: o se aplica completo y queda registrado,
#   o no se aplica nada.
# - Por eso un script no abre ni confirma transacciones propias y no usa
#   instrucciones que no se permiten dentro de una transacción
#   (por ejemplo CREATE DATABASE o ALTER DATABASE).
set -eu

: "${MSSQL_SA_PASSWORD:?Falta MSSQL_SA_PASSWORD}"
: "${DB_NAME:?Falta DB_NAME}"

# Solo se aceptan nombres simples para evitar inyectar SQL desde variables.
case "$DB_NAME" in
    *[!A-Za-z0-9_]*) echo "DB_NAME solo admite letras, números y _" >&2; exit 1 ;;
esac

export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"
# -b termina con error ante cualquier fallo de SQL.
# -I activa QUOTED_IDENTIFIER, necesario para índices filtrados y columnas calculadas.
# -f 65001 lee los scripts como UTF-8 para conservar tildes y eñes.
SQLCMD="/opt/mssql-tools18/bin/sqlcmd -S db -U sa -C -b -I -f 65001"

$SQLCMD -Q "IF DB_ID(N'$DB_NAME') IS NULL CREATE DATABASE [$DB_NAME];"

$SQLCMD -d "$DB_NAME" -Q "
IF OBJECT_ID(N'dbo.ScriptsAplicados', N'U') IS NULL
    CREATE TABLE dbo.ScriptsAplicados (
        IDScriptAplicado INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Nombre NVARCHAR(200) NOT NULL UNIQUE,
        FechaAplicado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
    );"

for archivo in /scripts/*.sql; do
    [ -e "$archivo" ] || continue
    nombre=$(basename "$archivo")

    case "$nombre" in
        [0-9][0-9][0-9]_*.sql) ;;
        *) echo "Nombre inválido: $nombre (use NNN_descripcion.sql)" >&2; exit 1 ;;
    esac
    case "$nombre" in
        *[!A-Za-z0-9_.-]*) echo "Nombre inválido: $nombre (solo letras, números, _, . y -)" >&2; exit 1 ;;
    esac

    # Se guarda la salida sin tubería para no perder el código de salida de sqlcmd.
    if ! salida=$($SQLCMD -d "$DB_NAME" -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.ScriptsAplicados WHERE Nombre = N'$nombre';"); then
        echo "No se pudo consultar ScriptsAplicados para $nombre" >&2
        echo "$salida" >&2
        exit 1
    fi
    aplicado=$(printf '%s' "$salida" | tr -d '[:space:]')

    case "$aplicado" in
        0)
            echo "Aplicando $nombre"
            envoltorio=$(mktemp)
            cat > "$envoltorio" <<EOF
:on error exit
SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO
:r $archivo
GO
IF @@TRANCOUNT <> 1 THROW 50000, N'El script cambió la transacción de aplicar.sh', 1;
INSERT INTO dbo.ScriptsAplicados (Nombre) VALUES (N'$nombre');
COMMIT TRANSACTION;
GO
EOF
            if ! $SQLCMD -d "$DB_NAME" -i "$envoltorio"; then
                rm -f "$envoltorio"
                echo "Falló $nombre; no se registró ningún cambio" >&2
                exit 1
            fi
            rm -f "$envoltorio"
            ;;
        1)
            echo "Omitido $nombre"
            ;;
        *)
            echo "Respuesta inesperada al consultar $nombre: '$aplicado'" >&2
            exit 1
            ;;
    esac
done

echo "Base de datos lista"
