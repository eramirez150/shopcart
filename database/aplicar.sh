#!/bin/sh
# Aplica los scripts de las carpetas numeradas de esta carpeta.
#
# Orden: las carpetas 01_ a 06_ en orden numérico y, dentro de cada una, los
# archivos en orden alfabético (incluidas las subcarpetas). pruebas/ no se aplica.
#
#   01_tablas, 02_semillas   Se aplican una sola vez. Cada archivo se registra
#                            en dbo.ScriptsAplicados con su ruta relativa.
#   03_funciones a           Usan CREATE OR ALTER y se aplican en cada ejecución,
#   06_permisos              así un cambio en un SP o una vista llega a una base
#                            que ya existe. No se registran.
#
# Cada archivo se ejecuta en su propia transacción (en 01 y 02, junto con su
# registro): o se aplica completo o no se aplica nada. Por eso un archivo no abre
# ni confirma transacciones y no usa instrucciones que no se permiten dentro de
# una (por ejemplo CREATE DATABASE o ALTER DATABASE).
#
# Un archivo contiene un solo objeto y se llama igual que él (SP_Pedidos_Listar.sql).
# Si una vista o función depende de otra, el nombre lleva un prefijo numérico
# para que se cree después de la que usa.
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

RAIZ=/scripts

$SQLCMD -Q "IF DB_ID(N'$DB_NAME') IS NULL CREATE DATABASE [$DB_NAME];" < /dev/null

$SQLCMD -d "$DB_NAME" -Q "
IF OBJECT_ID(N'dbo.ScriptsAplicados', N'U') IS NULL
    CREATE TABLE dbo.ScriptsAplicados (
        IDScriptAplicado INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Nombre NVARCHAR(200) NOT NULL UNIQUE,
        FechaAplicado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
    );" < /dev/null

# Ejecuta un archivo dentro de una transacción. Con $3 = registrar, guarda
# también su ruta relativa en dbo.ScriptsAplicados.
ejecutar() {
    archivo="$1"; nombre="$2"; registrar="$3"
    envoltorio=$(mktemp)
    {
        echo ":on error exit"
        echo "SET XACT_ABORT ON;"
        echo "BEGIN TRANSACTION;"
        echo "GO"
        echo ":r $archivo"
        echo "GO"
        echo "IF @@TRANCOUNT <> 1 THROW 50000, N'El script cambió la transacción de aplicar.sh', 1;"
        if [ "$registrar" = "registrar" ]; then
            echo "INSERT INTO dbo.ScriptsAplicados (Nombre) VALUES (N'$nombre');"
        fi
        echo "COMMIT TRANSACTION;"
        echo "GO"
    } > "$envoltorio"
    if ! $SQLCMD -d "$DB_NAME" -i "$envoltorio" < /dev/null; then
        rm -f "$envoltorio"
        echo "Falló $nombre; no se registró ningún cambio" >&2
        exit 1
    fi
    rm -f "$envoltorio"
}

lista=$(mktemp)
(cd "$RAIZ" && find . -type f -name '*.sql' ! -path './pruebas/*' | sed 's|^\./||' | LC_ALL=C sort) > "$lista"

while IFS= read -r nombre; do
    case "$nombre" in
        [0-9][0-9]_*/*) ;;
        *) echo "Ubicación inválida: $nombre (use NN_carpeta/archivo.sql)" >&2; exit 1 ;;
    esac
    case "$nombre" in
        *[!A-Za-z0-9_./-]*) echo "Nombre inválido: $nombre (solo letras, números, _, . / y -)" >&2; exit 1 ;;
    esac
    archivo="$RAIZ/$nombre"

    case "$nombre" in
        01_*|02_*)
            # Una sola vez: se consulta el registro. La salida se guarda sin
            # tubería para no perder el código de salida de sqlcmd.
            if ! salida=$($SQLCMD -d "$DB_NAME" -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.ScriptsAplicados WHERE Nombre = N'$nombre';" < /dev/null); then
                echo "No se pudo consultar ScriptsAplicados para $nombre" >&2
                echo "$salida" >&2
                exit 1
            fi
            aplicado=$(printf '%s' "$salida" | tr -d '[:space:]')
            case "$aplicado" in
                0) echo "Aplicando $nombre"; ejecutar "$archivo" "$nombre" registrar ;;
                1) echo "Omitido $nombre" ;;
                *) echo "Respuesta inesperada al consultar $nombre: '$aplicado'" >&2; exit 1 ;;
            esac
            ;;
        0[3-6]_*)
            # Idempotentes: se aplican siempre.
            echo "Aplicando $nombre"
            ejecutar "$archivo" "$nombre" ""
            ;;
        *)
            echo "Carpeta no reconocida: $nombre" >&2
            exit 1
            ;;
    esac
done < "$lista"
rm -f "$lista"

# La aplicación entra con shopcart_app, que solo tiene EXECUTE por el rol RolShopCartApp.
# Su clave viene del entorno y no debe llevar comillas.
$SQLCMD -d "$DB_NAME" -v CLAVE="$APP_DB_PASSWORD" -Q "
IF SUSER_ID(N'shopcart_app') IS NULL
    CREATE LOGIN shopcart_app WITH PASSWORD = N'\$(CLAVE)';
ELSE
    ALTER LOGIN shopcart_app WITH PASSWORD = N'\$(CLAVE)';
IF DATABASE_PRINCIPAL_ID(N'shopcart_app') IS NULL
    CREATE USER shopcart_app FOR LOGIN shopcart_app;
ALTER ROLE RolShopCartApp ADD MEMBER shopcart_app;" < /dev/null

echo "Base de datos lista"
