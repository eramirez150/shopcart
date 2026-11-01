# ShopCart

Plataforma web de ventas con SQL Server, API en Express con TypeScript y frontend en React con TypeScript.

## Requisitos

Docker con Docker Compose.

## Instalación

```bash
git clone https://github.com/eramirez150/shopcart.git
cd shopcart
cp .env.example .env
docker compose up --build
```

La base de datos queda disponible en `localhost,14335`. Los scripts de `database/` se aplican en orden y solo una vez.
