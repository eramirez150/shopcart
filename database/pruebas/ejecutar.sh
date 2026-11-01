#!/bin/sh
# Ejecuta las pruebas SQL de esta carpeta contra la base, con el usuario sa.
# Cada archivo termina con error ante el primer fallo. Uso con Docker Compose:
#   docker compose run --rm --entrypoint /bin/sh db-init /scripts/pruebas/ejecutar.sh
set -eu

: "${MSSQL_SA_PASSWORD:?Falta MSSQL_SA_PASSWORD}"
: "${DB_NAME:?Falta DB_NAME}"

export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"
SQLCMD="/opt/mssql-tools18/bin/sqlcmd -S db -U sa -C -b -I -f 65001 -d $DB_NAME"

for archivo in /scripts/pruebas/*.sql; do
    echo "== $(basename "$archivo")"
    # Solo se muestran las líneas OK y FALLO; los SP también devuelven resultados.
    if ! $SQLCMD -i "$archivo" < /dev/null > /tmp/salida.txt 2>&1; then
        cat /tmp/salida.txt >&2
        echo "Falló $(basename "$archivo")" >&2
        exit 1
    fi
    grep -E '^(OK|FALLO)' /tmp/salida.txt || true
done
echo "Pruebas SQL terminadas sin fallos"
