# ShopCart

Plataforma web de ventas con SQL Server, API en Express con TypeScript y frontend en React con TypeScript (Fase 2).
La especificación está en [docs/especificacion.md](docs/especificacion.md). Esta entrega (Fase 1) incluye la base de datos y el backend.

## Requisitos

- Docker con Docker Compose.
- Node.js 24 o superior, solo para desarrollar la API fuera de Docker.

## Instalación

```bash
git clone https://github.com/eramirez150/shopcart.git
cd shopcart
cp .env.example .env
```

Editar `.env` y definir estos tres valores, sin comillas. Si falta alguno, `docker compose` se detiene con un error.

| Variable | Descripción |
| --- | --- |
| `MSSQL_SA_PASSWORD` | Clave de `sa`: mínimo 8 caracteres con mayúsculas, minúsculas, números y símbolos |
| `APP_DB_PASSWORD` | Clave de `shopcart_app`, con las mismas reglas |
| `JWT_SECRET` | Al menos 32 caracteres aleatorios |

```bash
docker compose up --build
```

La API queda en `http://localhost:3000/api` y su documentación en `http://localhost:3000/api/docs`. La base de datos queda disponible solo desde la propia máquina en `127.0.0.1,14335`. Los scripts de `database/` se aplican en orden y solo una vez.

### Usuario de la aplicación

La API no usa `sa`: usa `shopcart_app`, que solo tiene `EXECUTE` sobre los stored procedures por medio del rol `RolShopCartApp` (script `012_permisos.sql`). `database/aplicar.sh` lo crea con la clave de `APP_DB_PASSWORD`.

### API fuera de Docker

```bash
cd api
npm install
```

Crear `api/.env` con estas variables (la API también las lee del entorno):

| Variable | Descripción | Por defecto |
| --- | --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | Dónde está la base | `127.0.0.1`, `14335`, `ShopCart` |
| `DB_USER`, `DB_PASSWORD` | Usuario de la aplicación (`shopcart_app`) | obligatorias |
| `JWT_SECRET` | Al menos 32 caracteres aleatorios. Generar con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` | obligatoria |
| `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS` | Vida del token de acceso y del refresh token | `15`, `7` |
| `PORT`, `CORS_ORIGIN` | Puerto y orígenes permitidos separados por coma | `3000`, `http://localhost:5173` |

```bash
npm run dev      # desarrollo con recarga
npm run build && npm start
```

La documentación interactiva está en `http://localhost:3000/api/docs` (Swagger UI, con botón **Authorize** para pegar el JWT). El contrato escrito a mano es [api/openapi.yaml](api/openapi.yaml).

### Pruebas

```bash
cd api
npm run typecheck
npm test
```

`seguridad.test.ts` no necesita base de datos. `flujo.test.ts` y `concurrencia.test.ts` exigen una base **recién creada** con todos los scripts y una conexión (`DB_USER` y `DB_PASSWORD`, o `TEST_DB_CONNECTION_STRING` con el controlador `msnodesqlv8` para SQL Server LocalDB). Sin conexión se omiten. Crean y modifican datos: usar una base de pruebas.

Las pruebas de permisos del usuario de la aplicación están en `database/pruebas/permisos.sql` (no es un script numerado y `aplicar.sh` no lo ejecuta).

## Credenciales de prueba

Solo para desarrollo, creadas por `002_semillas.sql`. Cámbielas o elimínelas en cualquier entorno real.

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin@shopcart.test` | `Admin123!` |
| Operador | `operador@shopcart.test` | `Operador123!` |
| Cliente | `cliente@shopcart.test` | `Cliente123!` |
| Cliente | `cliente2@shopcart.test` | `Cliente123!` |

Cupones de ejemplo: `BIENVENIDA10` (10 %, una vez por cliente), `Q50` (Q50 con compra mínima de Q300), `ELECTRO15` (15 % solo en Electrónica), `LIMITADO5` (5 usos en total), `VENCIDO` e `INACTIVO` (para ver los rechazos).

## Scripts de base de datos

- Cada script se llama `NNN_descripcion.sql`, con un prefijo de tres dígitos. `aplicar.sh` rechaza otros nombres.
- `aplicar.sh` ejecuta cada script pendiente dentro de una transacción junto con su registro en `dbo.ScriptsAplicados`. Si algo falla, no queda nada a medias y el contenedor `db-init` termina con error.
- Un script no abre ni confirma transacciones propias. Los SP usan `CREATE OR ALTER`.

| Script | Contenido |
| --- | --- |
| `001_tablas.sql` | Tablas, llaves, restricciones, índices, bitácora inmutable y sus triggers |
| `002_semillas.sql` | Usuarios por rol, 8 categorías, 50 productos con variantes, kardex inicial y cupones |
| `003_inventario.sql` | Disponibilidad, kardex (`SP_Inventario_RegistrarMovimiento`) y movimientos manuales |
| `004_cupones.sql` | Cálculo de descuento, validación con causa específica y consumo del uso |
| `005_checkout.sql` | Reserva de 15 minutos |
| `006_pedidos.sql` | Creación atómica del pedido y cambio de estado |
| `007_autenticacion.sql` | Registro, refresh tokens con rotación y gestión de usuarios |
| `008_catalogo.sql` | Categorías, productos y variantes, búsqueda con filtros |
| `009_carrito.sql` | Carrito de usuario o invitado, cupón y fusión al iniciar sesión |
| `010_cupones_devoluciones.sql` | Administración de cupones y devoluciones |
| `011_reportes.sql` | Listado de pedidos, dashboard y bitácora |
| `012_permisos.sql` | Rol de aplicación con solo `EXECUTE` |

## Decisiones técnicas

| Riesgo | Decisión |
| --- | --- |
| Sobreventa | `SP_Checkout_IniciarPago` bloquea las variantes con `UPDLOCK, HOLDLOCK` en orden de `IDVariante` y compara contra el disponible. Una prueba lanza 25 compras simultáneas de 4 unidades y exactamente 4 pasan. |
| Reserva vencida | Disponible = existencia − reservas `Activa` con `Expira` futura (`FU_Inventario_Disponibilidad`). Sin proceso programado. Iniciar el pago otra vez anula la reserva anterior, vencida o no. |
| Precio congelado | `ReservaDetalle` guarda precio y descuento; `PedidoDetalle` los copia. |
| Pedido duplicado | `Pedidos.IDReserva` es `UNIQUE` y la fila de la reserva se bloquea: un reintento espera y devuelve el mismo pedido. |
| Cupón concurrente | `UPDATE Cupones SET Usos = Usos + 1 WHERE Usos < LimiteTotal` y revisión de `@@ROWCOUNT`; la misma transacción revisa el límite por cliente. |
| Descuento exacto | El descuento total se calcula una vez y se reparte por líneas con diferencias de sumas acumuladas redondeadas: las líneas suman exactamente el total y nunca superan su valor. |
| Datos de otro cliente | `@IDUsuario` sale del JWT. Además, los SP vuelven a verificar el rol y la propiedad. |
| Estados | Tabla `PedidoTransiciones`, validada en el servicio y en `SP_Pedidos_CambiarEstado`. |
| Existencia | Solo `SP_Inventario_RegistrarMovimiento` la cambia, junto con su fila de kardex en la misma transacción. |
| Bitácora | Triggers sobre productos, variantes, cupones y estado de pedidos, más un trigger `INSTEAD OF UPDATE, DELETE` que la hace inmutable. El SP guarda el usuario con `sp_set_session_context`. |
| Permisos | Rol `RolShopCartApp` con `EXECUTE` y nada más. Se verifica en `database/pruebas/permisos.sql`. |
| Errores | Los SP lanzan `THROW 52000 + código HTTP` (`52409` es 409). La API lo traduce en un solo lugar. |
| Sesiones | Access token de 15 minutos (token expirado: 401). Refresh token aleatorio de un solo uso: en la base solo se guarda su SHA-256; reusar uno revocado cierra todas las sesiones del usuario. Contraseñas con bcrypt (costo 10). |
| Venta neta | Un pedido completado es `Entregado` o `DevueltoParcial`. El dashboard descuenta las devoluciones y las fechas filtran por la del pedido. |
| Pago | Simulado: confirmar el pago crea el pedido con una referencia única. |

Limitaciones conocidas: un usuario desactivado conserva su token de acceso hasta que vence (15 minutos) y no puede renovarlo; no hay límite de intentos de inicio de sesión.

## Modelo entidad-relación

```mermaid
erDiagram
    Usuarios ||--o{ RefreshTokens : "sesiones"
    Usuarios ||--o{ Carritos : "tiene"
    Usuarios ||--o{ Reservas : "reserva"
    Usuarios ||--o{ Pedidos : "compra"
    Categorias ||--o{ Productos : "agrupa"
    Categorias |o--o{ Cupones : "alcance"
    Productos ||--o{ Variantes : "tiene"
    Variantes ||--o{ Kardex : "movimientos"
    Carritos ||--o{ CarritoDetalle : "lineas"
    Variantes ||--o{ CarritoDetalle : ""
    Cupones |o--o{ Carritos : "aplicado"
    Carritos ||--o{ Reservas : "genera"
    Reservas ||--o{ ReservaDetalle : "lineas"
    Variantes ||--o{ ReservaDetalle : ""
    Reservas ||--o| Pedidos : "se convierte en"
    PedidoEstados ||--o{ Pedidos : "estado"
    PedidoEstados ||--o{ PedidoTransiciones : "permite"
    Pedidos ||--o{ PedidoDetalle : "lineas"
    Variantes ||--o{ PedidoDetalle : ""
    Pedidos ||--o{ PedidoHistorial : "cambios"
    Pedidos ||--o| CuponUsos : "uso"
    Cupones ||--o{ CuponUsos : ""
    Pedidos ||--o{ Devoluciones : "devuelve"
    Devoluciones ||--o{ DevolucionDetalle : "lineas"
    PedidoDetalle ||--o{ DevolucionDetalle : ""
    Pedidos |o--o{ Kardex : "origen"
    Usuarios ||--o{ Bitacora : "autor"
```

## Diagramas de estados

Pedido (las transiciones salen de `PedidoTransiciones`):

```mermaid
stateDiagram-v2
    [*] --> Pagado: confirmar el pago
    Pagado --> EnPreparacion: Operador
    EnPreparacion --> Despachado: Operador
    Despachado --> Entregado: Operador
    Pagado --> Cancelado: antes del despacho
    EnPreparacion --> Cancelado: antes del despacho
    Entregado --> DevueltoParcial: devolución de parte
    Entregado --> Devuelto: devolución total
    DevueltoParcial --> Devuelto: devolución del resto
    DevueltoParcial --> DevueltoParcial: otra devolución parcial
    Cancelado --> [*]
    Devuelto --> [*]
```

Reserva de existencia:

```mermaid
stateDiagram-v2
    [*] --> Activa: iniciar pago (15 minutos)
    Activa --> Consumida: se crea el pedido
    Activa --> Anulada: cambia el carrito, se cancela el pago o se inicia otro pago
    Activa --> Vencida: pasa Expira
    Vencida --> [*]: ya no resta del disponible
    Consumida --> [*]
    Anulada --> [*]
```

`Vencida` no es un valor guardado: es una reserva `Activa` con `Expira` en el pasado.

## Flujo de compra

1. `POST /api/carrito/items` agrega productos (con sesión o con `X-Carrito-Token` de invitado).
2. `PUT /api/carrito/cupon` aplica un cupón.
3. `POST /api/checkout/pagos` reserva la existencia 15 minutos.
4. `POST /api/checkout/reservas/{id}/pedido` confirma el pago simulado y crea el pedido.
5. El Operador avanza el pedido con `PATCH /api/pedidos/{id}/estado`; las devoluciones se registran en `POST /api/pedidos/{id}/devoluciones`.

## Estado de la verificación

Los scripts y las pruebas se ejecutaron en SQL Server LocalDB 2019. `docker compose up` (SQL Server 2022 y `aplicar.sh`) no se ha podido probar en la máquina de desarrollo.
