import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { direccion, hayBase, iniciarServidor } from './ayuda.js';

// Reglas de negocio que no cubre el flujo completo. Cada prueba crea sus propios datos.
describe('reglas de precio, propiedad y cupones', { skip: !hayBase && 'sin conexión a la base' }, () => {
  let s: Awaited<ReturnType<typeof iniciarServidor>>;
  let admin = '';
  before(async () => {
    s = await iniciarServidor();
    admin = await s.login('admin@shopcart.test', 'Admin123!');
  });
  after(async () => {
    await s.cerrar();
  });

  const marca = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  async function crearVariante(precio: number, existencia: number, idCategoria = 1) {
    const p = await s.pedir('POST', '/productos', { token: admin, cuerpo: { idCategoria, nombre: 'Reglas ' + marca() } });
    const v = await s.pedir('POST', `/productos/${p.datos.IDProducto}/variantes`, {
      token: admin,
      cuerpo: { sku: 'REG-' + marca(), precio, existenciaInicial: existencia },
    });
    return v.datos.variantes[0] as { IDVariante: number; SKU: string };
  }

  const cambiarPrecio = (v: { IDVariante: number; SKU: string }, precio: number) =>
    s.pedir('PUT', `/productos/variantes/${v.IDVariante}`, { token: admin, cuerpo: { sku: v.SKU, precio } });

  async function comprar(token: string, idVariante: number, cantidad: number, extra: object = {}) {
    await s.pedir('POST', '/carrito/items', { token, cuerpo: { idVariante, cantidad } });
    const reserva = await s.pedir('POST', '/checkout/pagos', { token, cuerpo: { ...direccion, ...extra } });
    assert.equal(reserva.estado, 201, JSON.stringify(reserva.datos));
    return reserva;
  }

  test('cambio de precio: la reserva y el pedido conservan el precio con el que se compró', async () => {
    const v = await crearVariante(100, 10);
    const c = await s.registrar('precio');
    const reserva = await comprar(c.token, v.IDVariante, 2);

    // El precio sube entre la reserva y el pago: el pedido usa el precio reservado.
    assert.equal((await cambiarPrecio(v, 150)).estado, 200);
    const pedido = await s.pedir('POST', `/checkout/reservas/${reserva.datos.IDReserva}/pedido`, { token: c.token });
    assert.equal(pedido.estado, 201);
    assert.equal(pedido.datos.lineas[0].PrecioUnitario, 100);
    assert.equal(pedido.datos.Total, 200);

    // Después del pedido el precio vuelve a cambiar y el pedido no se altera.
    await cambiarPrecio(v, 80);
    const despues = await s.pedir('GET', `/pedidos/${pedido.datos.IDPedido}`, { token: c.token });
    assert.equal(despues.datos.lineas[0].PrecioUnitario, 100);
    assert.equal(despues.datos.Subtotal, 200);
    assert.equal(despues.datos.Total, 200);

    // Un carrito nuevo sí ve el precio actual.
    const carrito = await s.pedir('POST', '/carrito/items', { token: c.token, cuerpo: { idVariante: v.IDVariante, cantidad: 1 } });
    assert.equal(carrito.datos.Subtotal, 80);

    // El cambio de precio quedó en la bitácora con el valor anterior y el nuevo.
    const bit = await s.pedir('GET', '/bitacora?modulo=Catalogo&tamano=20', { token: admin });
    const cambio = bit.datos.datos.find(
      (b: { Entidad: string; IDEntidad: number; ValorNuevo: string }) =>
        b.Entidad === 'Variante' && b.IDEntidad === v.IDVariante && JSON.parse(b.ValorNuevo).Precio === 80,
    );
    assert.equal(JSON.parse(cambio.ValorAnterior).Precio, 150);
  });

  test('un cliente no puede cancelar el pedido ni la reserva de otro', async () => {
    const v = await crearVariante(60, 10);
    const a = await s.registrar('dueno');
    const b = await s.registrar('ajeno');
    const reserva = await comprar(a.token, v.IDVariante, 3);

    // La reserva ajena no existe para B.
    assert.equal((await s.pedir('DELETE', `/checkout/reservas/${reserva.datos.IDReserva}`, { token: b.token })).estado, 404);
    assert.equal((await s.pedir('POST', `/checkout/reservas/${reserva.datos.IDReserva}/pedido`, { token: b.token })).estado, 404);

    const pedido = await s.pedir('POST', `/checkout/reservas/${reserva.datos.IDReserva}/pedido`, { token: a.token });
    const idPedido = pedido.datos.IDPedido as number;
    const cancelar = await s.pedir('PATCH', `/pedidos/${idPedido}/estado`, { token: b.token, cuerpo: { estado: 'Cancelado' } });
    assert.equal(cancelar.estado, 404);

    // El pedido sigue Pagado y la existencia no se reintegró.
    const actual = await s.pedir('GET', `/pedidos/${idPedido}`, { token: a.token });
    assert.equal(actual.datos.Estado, 'Pagado');
    assert.equal(actual.datos.historial.length, 1);
    const kardex = await s.pedir('GET', `/inventario/variantes/${v.IDVariante}/kardex`, { token: admin });
    assert.equal(kardex.datos.datos[0].ExistenciaResultante, 7);

    // El dueño sí puede cancelar.
    assert.equal((await s.pedir('PATCH', `/pedidos/${idPedido}/estado`, { token: a.token, cuerpo: { estado: 'Cancelado' } })).estado, 200);
  });

  test('cupón de monto mayor que el carrito: el descuento se limita y el total queda en cero', async () => {
    const codigo = 'GRANDE' + marca();
    const cupon = await s.pedir('POST', '/cupones', {
      token: admin,
      cuerpo: { codigo, tipo: 'Monto', valor: 500, fechaInicio: '2026-01-01T00:00:00Z', fechaFin: '2030-01-01T00:00:00Z' },
    });
    assert.equal(cupon.estado, 201);
    const v = await crearVariante(100, 10);
    const c = await s.registrar('cupon-grande');
    await s.pedir('POST', '/carrito/items', { token: c.token, cuerpo: { idVariante: v.IDVariante, cantidad: 1 } });

    const carrito = await s.pedir('PUT', '/carrito/cupon', { token: c.token, cuerpo: { codigo } });
    assert.equal(carrito.estado, 200);
    assert.deepEqual([carrito.datos.Subtotal, carrito.datos.Descuento, carrito.datos.Total], [100, 100, 0]);

    const reserva = await s.pedir('POST', '/checkout/pagos', { token: c.token, cuerpo: direccion });
    assert.deepEqual([reserva.datos.Descuento, reserva.datos.Total], [100, 0]);
    const pedido = await s.pedir('POST', `/checkout/reservas/${reserva.datos.IDReserva}/pedido`, { token: c.token });
    assert.equal(pedido.estado, 201);
    assert.deepEqual([pedido.datos.Descuento, pedido.datos.Total, pedido.datos.IVA], [100, 0, 0]);
    assert.ok(pedido.datos.lineas.every((l: { Descuento: number; Cantidad: number; PrecioUnitario: number }) => l.Descuento <= l.Cantidad * l.PrecioUnitario));
  });

  test('cupón de categoría mayor que lo elegible: solo descuenta las líneas de esa categoría', async () => {
    const codigo = 'CATG' + marca();
    await s.pedir('POST', '/cupones', {
      token: admin,
      cuerpo: { codigo, tipo: 'Monto', valor: 500, fechaInicio: '2026-01-01T00:00:00Z', fechaFin: '2030-01-01T00:00:00Z', idCategoria: 1 },
    });
    const electronica = await crearVariante(100, 10, 1);
    const otra = await crearVariante(50, 10, 2);
    const c = await s.registrar('cupon-cat');
    await s.pedir('POST', '/carrito/items', { token: c.token, cuerpo: { idVariante: electronica.IDVariante, cantidad: 1 } });
    await s.pedir('POST', '/carrito/items', { token: c.token, cuerpo: { idVariante: otra.IDVariante, cantidad: 1 } });
    const carrito = await s.pedir('PUT', '/carrito/cupon', { token: c.token, cuerpo: { codigo } });
    assert.deepEqual([carrito.datos.Subtotal, carrito.datos.Descuento, carrito.datos.Total], [150, 100, 50]);
  });
});
