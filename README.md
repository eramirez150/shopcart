# ShopCart

Plataforma web de ventas con SQL Server, API en Express con TypeScript y frontend en React con TypeScript.

## Requisitos

Docker con Docker Compose.

## Instalación

```bash
git clone https://github.com/eramirez150/shopcart.git
cd shopcart
cp .env.example .env
```

Editar `.env` y escribir una clave propia en `MSSQL_SA_PASSWORD` (mínimo 8 caracteres con mayúsculas, minúsculas, números y símbolos). El archivo de ejemplo la trae vacía a propósito: si no se define, `docker compose` se detiene con un error.

```bash
docker compose up --build
```

La base de datos queda disponible solo desde la propia máquina en `127.0.0.1,14335`. Los scripts de `database/` se aplican en orden y solo una vez.

## Scripts de base de datos

- Cada script se llama `NNN_descripcion.sql`, con un prefijo de tres dígitos (`001_tablas.sql`, `002_semillas.sql`, ...). `aplicar.sh` rechaza otros nombres.
- `aplicar.sh` ejecuta cada script pendiente dentro de una transacción junto con su registro en `dbo.ScriptsAplicados`. Si algo falla, no queda nada a medias y el contenedor `db-init` termina con error.
- Un script no abre ni confirma transacciones propias.
