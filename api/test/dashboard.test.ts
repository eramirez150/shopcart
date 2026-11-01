import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { direccion, hayBase, iniciarServidor } from './ayuda.js';

// Montos del dashboard con una categoría propia de la prueba, para que otros datos no
// interfieran. Los indicadores se comparan antes y después, con el rango del día de hoy.
describe('dashboard: ventas netas y ticket promedio', { skip: !hayBase && 'sin conexión a la base' }, () => {
  let s: Awaited<ReturnType<typeof iniciarServidor>>;
  let admin = '', operador = '';
  before(async () => {
    s = await iniciarServidor();
    admin = await s.login('admin@shopcart.test', 'Admin123!');
    operador = await s.login('operador@shopcart.test', 'Operador123!');
  });
  after(async () => {
    await s.cerrar();
  });

  const hoy = new Date().toISOString().slice(0, 10);
  const rango = `desde=${hoy}&hasta=${hoy}`;
  const indicadores = async () => (await s.pedir('GET', `/dashboard/indicadores?${rango}`, { token: admin })).datos;
  async function ventasDeHoy(): Promise<number> {
    const r = await s.pedir('GET', `/dashboard/ventas?agrupacion=Dia&${rango}`, { token: admin });
    return (r.datos as { Periodo: string; Ventas: number }[]).find((f) => f.Periodo.startsWith(hoy))?.Ventas ?? 0;
  }
  const centavos = (n: number) => Math.round(n * 100);

  test('una devolución descuenta de las ventas netas, pero no del monto vendido del ticket promedio', async () => {
    const marca = `${Date.now()}`;
    const cat = await s.pedir('POST', '/categorias', { token: admin, cuerpo: { nombre: 'Dashboard ' + marca } });
    const prod = await s.pedir('POST', '/productos', { token: admin, cuerpo: { idCategoria: cat.datos.IDCategoria, nombre: 'Producto dashboard ' + marca } });
    const vari = await s.pedir('POST', `/productos/${prod.datos.IDProducto}/variantes`, {
      token: admin,
      cuerpo: { sku: 'DASH-' + marca, precio: 100, existenciaInicial: 10 },
    });
    const idVariante = vari.datos.variantes[0].IDVariante as number;

    const antes = await indicadores();
    const ventasAntes = await ventasDeHoy();

    // Un pedido de 3 unidades a Q100.
    const c = await s.registrar('dash');
    await s.pedir('POST', '/carrito/items', { token: c.token, cuerpo: { idVariante, cantidad: 3 } });
    const reserva = await s.pedir('POST', '/checkout/pagos', { token: c.token, cuerpo: direccion });
    const pedido = await s.pedir('POST', `/checkout/reservas/${reserva.datos.IDReserva}/pedido`, { token: c.token });
    assert.equal(pedido.datos.Total, 300);
    const idPedido = pedido.datos.IDPedido as number;

    // Pagado: cuenta para el ticket promedio, todavía no para las ventas completadas.
    const pagado = await indicadores();
    assert.equal(pagado.PedidosPagados, antes.PedidosPagados + 1);
    assert.equal(centavos(pagado.MontoVendido - antes.MontoVendido), 30000);
    assert.equal(pagado.Pedidos, antes.Pedidos);
    assert.equal(centavos(pagado.Ventas), centavos(antes.Ventas));
    assert.equal(pagado.TicketPromedio, Math.round((pagado.MontoVendido / pagado.PedidosPagados) * 100) / 100);

    for (const estado of ['EnPreparacion', 'Despachado', 'Entregado']) {
      assert.equal((await s.pedir('PATCH', `/pedidos/${idPedido}/estado`, { token: operador, cuerpo: { estado } })).estado, 200);
    }
    const entregado = await indicadores();
    assert.equal(entregado.Pedidos, antes.Pedidos + 1);
    assert.equal(centavos(entregado.Ventas - antes.Ventas), 30000);

    // Se devuelve 1 de las 3 unidades: Q100.
    const linea = pedido.datos.lineas[0].IDPedidoDetalle as number;
    const dev = await s.pedir('POST', `/pedidos/${idPedido}/devoluciones`, {
      token: operador,
      cuerpo: { motivo: 'Prueba de dashboard', lineas: [{ idPedidoDetalle: linea, cantidad: 1 }] },
    });
    assert.equal(dev.estado, 201);

    const despues = await indicadores();
    // Ventas netas: 300 - 100. El pedido DevueltoParcial sigue completado.
    assert.equal(despues.Pedidos, antes.Pedidos + 1);
    assert.equal(centavos(despues.Ventas - antes.Ventas), 20000);
    // Ticket promedio: monto vendido entre pedidos pagados; la devolución no lo cambia.
    assert.equal(despues.PedidosPagados, antes.PedidosPagados + 1);
    assert.equal(centavos(despues.MontoVendido - antes.MontoVendido), 30000);
    assert.equal(despues.TicketPromedio, pagado.TicketPromedio);

    // Ventas por día y por categoría también son netas.
    assert.equal(centavos((await ventasDeHoy()) - ventasAntes), 20000);
    const categorias = await s.pedir('GET', `/dashboard/categorias?${rango}`, { token: admin });
    const mia = (categorias.datos as { IDCategoria: number; Unidades: number; Ventas: number }[]).find(
      (f) => f.IDCategoria === cat.datos.IDCategoria,
    )!;
    assert.deepEqual({ Unidades: mia.Unidades, Ventas: mia.Ventas }, { Unidades: 2, Ventas: 200 });
  });

  test('un pedido cancelado no cuenta en el ticket promedio', async () => {
    const antes = await indicadores();
    const c = await s.registrar('dash-cancela');
    const ex = await s.pedir('GET', '/inventario/existencias?tamano=100&orden=sku', { token: operador });
    const idVariante = (ex.datos.datos as { SKU: string; IDVariante: number }[]).find((v) => v.SKU === 'COM-USB-64')!.IDVariante;
    await s.pedir('POST', '/carrito/items', { token: c.token, cuerpo: { idVariante, cantidad: 1 } });
    const reserva = await s.pedir('POST', '/checkout/pagos', { token: c.token, cuerpo: direccion });
    const pedido = await s.pedir('POST', `/checkout/reservas/${reserva.datos.IDReserva}/pedido`, { token: c.token });
    assert.equal((await indicadores()).PedidosPagados, antes.PedidosPagados + 1);
    await s.pedir('PATCH', `/pedidos/${pedido.datos.IDPedido}/estado`, { token: c.token, cuerpo: { estado: 'Cancelado' } });
    const despues = await indicadores();
    assert.equal(despues.PedidosPagados, antes.PedidosPagados);
    assert.equal(centavos(despues.MontoVendido), centavos(antes.MontoVendido));
  });
});
