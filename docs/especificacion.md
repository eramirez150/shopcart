# Especificación de ShopCart

Plataforma de ventas en línea para una cadena de tiendas. Los montos están en quetzales y los precios publicados incluyen IVA del 12 %.

## Entregas

| Fase | Alcance | Cierre |
| --- | --- | --- |
| 1 | Base de datos y backend | Lunes 2 de noviembre de 2026, 23:59 |
| 2 | Frontend y proyecto completo | Lunes 9 de noviembre de 2026, 23:59 |

Se evalúa el último commit anterior a cada cierre. El historial debe ser legible y progresivo.

## Stack obligatorio

- Microsoft SQL Server 2019 o superior, con scripts SQL ordenados en carpetas numeradas (un objeto por archivo) y sin ORM.
- Node.js 24 LTS o superior, Express y TypeScript en modo `strict`.
- React 18 o superior con TypeScript.
- Todo el acceso a datos, incluidas las lecturas, se hace por stored procedures con parámetros tipados.
- No se concatena SQL. El SQL dinámico solo se permite con `sp_executesql` y parámetros.

## Nomenclatura de base de datos

| Objeto | Formato | Ejemplo |
| --- | --- | --- |
| Stored procedure | `SP_Modulo_Proceso` | `SP_Pedidos_CrearPedido` |
| Vista | `VW_Modulo_Proceso` | `VW_Dashboard_VentasPorCategoria` |
| Función tipo tabla | `FU_Modulo_Proceso` | `FU_Cupones_CalculoDescuento` |
| Llave primaria autoincrementable | `ID` + nombre | `IDProducto` |

Los montos usan `DECIMAL` y las cantidades `INT`. No se permite `FLOAT` ni `REAL`.

## Módulos

1. **Autenticación:** roles Cliente, Operador y Administrador. Registro con correo y contraseña con hash, JWT de corta duración y refresh token con rotación. Un usuario se desactiva sin borrarse. Token expirado responde 401 y recurso no permitido responde 403.
2. **Catálogo:** CRUD de categorías y de productos con variantes. Cada variante tiene SKU único, atributos, precio y existencia. Búsqueda, filtros por categoría, precio y disponibilidad, ordenamiento y paginación. Un producto con ventas se desactiva, no se elimina.
3. **Inventario:** kardex con usuario, fecha, motivo y cantidad para entrada, salida, ajuste y devolución. Disponible = existencia física − cantidades en reservas activas y no vencidas. Una reserva consumida (convertida en pedido) o anulada deja de contar. La existencia coincide con la suma del kardex. Un ajuste exige motivo y no deja la existencia en negativo.
4. **Carrito:** agregar, modificar y eliminar. Soporta carrito de invitado por token. Muestra subtotal, descuentos y total, sin errores de redondeo. No permite superar el disponible.
5. **Cupones:** porcentaje o monto fijo, vigencia, mínimo de compra, límite total, límite por cliente, alcance de carrito o categoría. Un cupón por pedido. El rechazo indica la causa específica. El límite se respeta con concurrencia y el total nunca baja de cero.
6. **Checkout:** dirección de entrega y reserva de 15 minutos al iniciar el pago. Sin sobreventa, sin pedidos ni cobros duplicados. Pedido, detalle, kardex y uso de cupón se guardan de forma atómica.
7. **Pedidos y devoluciones:** el Operador avanza los estados y el Cliente consulta solo los suyos. Se cancela antes del despacho. Devoluciones totales o parciales por línea, sin superar lo vendido. Cancelar o devolver reintegra por kardex y se refleja en reportes. Cada cambio registra usuario, fecha, estado anterior y nuevo.
8. **Dashboard:** ventas por día, semana y mes, en quetzales y número de pedidos; ventas por categoría; 10 productos más vendidos; listado filtrado de pedidos; carritos abandonados y ticket promedio. Paginación y filtros en el servidor. Solo cuenta pedidos completados y descuenta devoluciones.
9. **Bitácora:** registra creación, modificación o desactivación de productos, precios, existencias, cupones y estados, con usuario, fecha, entidad, acción, valor anterior y nuevo. Consultable por Administradores con filtro por módulo. No se puede modificar ni eliminar.
10. **Reseñas de producto:** calificación de 1 a 5 y comentario. Solo un Cliente con un pedido `Entregado` que contenga una variante del producto, una por usuario y producto. El listado es público, paginado, con las más recientes primero, promedio y total. El nombre público es el nombre y la inicial del apellido; nunca el correo ni el id del usuario.

El Operador gestiona pedidos e inventario. El Administrador gestiona además catálogo, precios, cupones, usuarios y reportes. El Cliente solo accede a su propia información.

## Backend

Rutas, servicios con la lógica de negocio y repositorios. Validación de esquemas, errores centralizados con códigos HTTP correctos, CORS, cabeceras de seguridad, variables de entorno con `.env.example`, documentación de la API y sin credenciales en el repositorio. Los listados y reportes principales responden en menos de 1 segundo.

## Decisiones técnicas

| Riesgo | Decisión |
| --- | --- |
| Sobreventa | Al reservar se bloquean las variantes con `UPDLOCK, HOLDLOCK`, ordenadas por `IDVariante`. |
| Reserva vencida | Disponible = existencia − cantidades de reservas con `Estado = Activa` y `Expira` futura. Una reserva `Consumida` o `Anulada` no cuenta. Se libera sin proceso programado. |
| Doble clic en pagar | Repetir el inicio del pago con el carrito sin cambios, la misma dirección y el mismo cupón devuelve la misma reserva activa y no vencida, sin anularla. |
| Reservado y ajustes | Una salida o un ajuste manual no deja la existencia por debajo de lo reservado: se rechaza con 409. |
| Direcciones | Tabla `Direcciones` por usuario. El cliente solo ve y modifica las suyas; se desactivan, no se borran. Reservas y pedidos guardan `IDDireccion` y copian el texto. |
| Precio congelado | `ReservaDetalle` guarda precio y descuento, y `PedidoDetalle` los copia. |
| Pedido duplicado | `Pedidos.IDReserva` es `UNIQUE`. Un reintento devuelve el mismo pedido. |
| Cupón concurrente | `UPDATE ... WHERE Usos < Limite` y revisión de `@@ROWCOUNT`, en la misma transacción que el límite por cliente. |
| Datos de otro cliente | `@IDUsuario` sale siempre del JWT, nunca del body ni de la URL. Los SP que lo reciben verifican rol y propiedad; los de lectura de inventario y catálogo no lo reciben y dependen de la API. |
| Estados | Tabla `PedidoTransiciones`, validada en el servicio, en `SP_Pedidos_CambiarEstado` y en el trigger `TR_Pedidos_ValidarTransicion` (AFTER UPDATE sobre `Pedidos`). |
| Bitácora | Trigger `INSTEAD OF UPDATE, DELETE`. |
| Permisos | El usuario de la aplicación solo tiene `EXECUTE` sobre los SP. |
| Pago | Simulado. El enunciado no exige pasarela. |

Estados de la reserva: `Activa`, `Consumida` (se convirtió en pedido) y `Anulada` (se modificó el carrito, se canceló el pago o se inició otro pago con otra dirección o cupón). Una reserva `Activa` con `Expira` pasada se considera vencida. Solo las reservas `Activa` y no vencidas restan del disponible.

Estados del pedido: `Pagado`, `EnPreparacion`, `Despachado`, `Entregado`, `DevueltoParcial`, `Devuelto` y `Cancelado`. Solo se permiten estas transiciones, registradas en `PedidoTransiciones`:

| Desde | Hacia | Cómo ocurre |
| --- | --- | --- |
| `Pagado` | `EnPreparacion` | El Operador avanza el pedido. |
| `EnPreparacion` | `Despachado` | El Operador avanza el pedido. |
| `Despachado` | `Entregado` | El Operador avanza el pedido. |
| `Pagado` | `Cancelado` | Cancelación antes del despacho. |
| `EnPreparacion` | `Cancelado` | Cancelación antes del despacho. |
| `Entregado` | `DevueltoParcial` | Devolución de parte de lo vendido. |
| `Entregado` | `Devuelto` | Devolución de todo lo vendido en una sola operación. |
| `DevueltoParcial` | `Devuelto` | Una devolución completa lo que quedaba por devolver. |

Una nueva devolución parcial sobre un pedido `DevueltoParcial` que no completa lo vendido lo deja en el mismo estado. `Cancelado` y `Devuelto` son estados finales.

Supuestos: un pedido completado es `Entregado` o `DevueltoParcial`; cancelar devuelve el uso del cupón y una devolución no; modificar el carrito anula la reserva activa; las devoluciones las registra solo un Operador o un Administrador; cupones y variantes se desactivan en vez de borrarse; los atributos de una variante se guardan como un objeto JSON.

## Glosario

| Término | Definición |
| --- | --- |
| Pedido pagado | Pedido creado al confirmar el pago simulado que no está `Cancelado`. |
| Pedido completado | Pedido `Entregado` o `DevueltoParcial`. |
| Ventas netas | Total de los pedidos completados menos sus devoluciones. Lo usan las ventas por periodo, por categoría y los productos más vendidos. |
| Ticket promedio | Monto total vendido (suma del total de los pedidos pagados) entre el número de pedidos pagados en un periodo. |
| Carrito abandonado | Carrito abierto con productos y sin cambios en las últimas 24 horas (valor por defecto, configurable en el reporte). |
| Compra verificada | Pedido `Entregado` del usuario con una variante del producto. Es lo que habilita una reseña. |
| Disponible | Existencia física menos lo reservado por reservas activas y no vencidas. |

## Orden de trabajo de la Fase 1

1. Tablas con llaves, restricciones e índices.
2. Semillas con unos 50 productos y usuarios de prueba por rol.
3. SP críticos: reservar existencia, crear pedido, kardex, cupones y cambio de estado.
4. SP restantes por módulo.
5. API por módulos, documentación y pruebas de concurrencia.
6. README con instalación, decisiones, diagrama entidad-relación, diagrama de estados y credenciales de prueba.
