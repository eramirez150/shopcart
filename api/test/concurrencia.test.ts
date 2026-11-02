import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { direccion, hayBase, iniciarServidor } from './ayuda.js';

// Pruebas de concurrencia reales: decenas de peticiones HTTP simultáneas contra la base.
// Cada ejecución crea sus propios productos, cupones y usuarios con nombres únicos.
describe('concurrencia', { skip: !hayBase && 'sin conexión a la base' }, () => {
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

  async function crearVariante(existencia: number) {
    const p = await s.pedir('POST', '/admin/productos', { token: admin, cuerpo: { idCategoria: 1, nombre: 'Concurrencia ' + marca() } });
    const v = await s.pedir('POST', `/admin/productos/${p.datos.IDProducto}/variantes`, {
      token: admin,
      cuerpo: { sku: 'CONC-' + marca(), precio: 100, existenciaInicial: existencia },
    });
    return { idProducto: p.datos.IDProducto as number, idVariante: v.datos.variantes[0].IDVariante as number };
  }

  const existencia = async (idProducto: number) =>
    (await s.pedir('GET', `/admin/productos/${idProducto}`, { token: admin })).datos.variantes[0] as { Existencia: number; Disponible: number };

  async function usuariosConCarrito(n: number, idVariante: number) {
    const usuarios = await Promise.all(Array.from({ length: n }, () => s.registrar('conc')));
    const altas = await Promise.all(
      usuarios.map((u) => s.pedir('POST', '/publico/carrito/items', { token: u.token, cuerpo: { idVariante, cantidad: 1 } })),
    );
    assert.ok(altas.every((a) => a.estado === 201));
    return usuarios;
  }

  test('sin sobreventa: 25 compradores simultáneos de una variante con 4 unidades', async () => {
    const { idProducto, idVariante } = await crearVariante(4);
    const usuarios = await usuariosConCarrito(25, idVariante);

    // Reservas simultáneas: solo caben 4.
    const reservas = await Promise.all(usuarios.map((u) => s.pedir('POST', '/cliente/checkout/pagos', { token: u.token, cuerpo: direccion })));
    const ok = reservas.filter((r) => r.estado === 201);
    const sinStock = reservas.filter((r) => r.estado === 409);
    assert.equal(ok.length, 4);
    assert.equal(sinStock.length, 21);
    assert.match(sinStock[0]!.datos.error.mensaje, /existencia suficiente/);
    assert.equal((await existencia(idProducto)).Disponible, 0);

    // Los 4 pagan a la vez; pagar dos veces cada reserva tampoco duplica nada.
    const pedidos = await Promise.all(
      usuarios.flatMap((u, i) =>
        reservas[i]!.estado === 201
          ? [1, 2].map(() => s.pedir('POST', `/cliente/checkout/reservas/${reservas[i]!.datos.IDReserva}/pedido`, { token: u.token }))
          : [],
      ),
    );
    assert.ok(pedidos.every((p) => p.estado === 201));
    assert.equal(new Set(pedidos.map((p) => p.datos.IDPedido)).size, 4);

    const v = await existencia(idProducto);
    assert.deepEqual({ Existencia: v.Existencia, Disponible: v.Disponible }, { Existencia: 0, Disponible: 0 });
    // La existencia coincide con la suma del kardex.
    const kardex = await s.pedir('GET', `/admin/inventario/variantes/${idVariante}/kardex?tamano=100`, { token: admin });
    const suma = kardex.datos.datos.reduce((a: number, k: { Cantidad: number }) => a + k.Cantidad, 0);
    assert.equal(suma, v.Existencia);
    assert.equal(kardex.datos.total, 5); // entrada inicial + 4 salidas
  });

  test('sin pedidos duplicados: 15 confirmaciones simultáneas de la misma reserva', async () => {
    const { idProducto, idVariante } = await crearVariante(10);
    const [u] = await usuariosConCarrito(1, idVariante);
    const reserva = await s.pedir('POST', '/cliente/checkout/pagos', { token: u!.token, cuerpo: direccion });
    assert.equal(reserva.estado, 201);

    const intentos = await Promise.all(
      Array.from({ length: 15 }, () => s.pedir('POST', `/cliente/checkout/reservas/${reserva.datos.IDReserva}/pedido`, { token: u!.token })),
    );
    assert.ok(intentos.every((r) => r.estado === 201), JSON.stringify(intentos.map((r) => r.estado)));
    assert.equal(new Set(intentos.map((r) => r.datos.IDPedido)).size, 1);
    assert.equal(new Set(intentos.map((r) => r.datos.ReferenciaPago)).size, 1);

    const mios = await s.pedir('GET', '/cliente/pedidos', { token: u!.token });
    assert.equal(mios.datos.total, 1);
    assert.equal((await existencia(idProducto)).Existencia, 9); // una sola salida
  });

  test('doble clic en pagar: 10 inicios de pago simultáneos devuelven la misma reserva activa', async () => {
    const { idProducto, idVariante } = await crearVariante(10);
    const [u] = await usuariosConCarrito(1, idVariante);
    await s.pedir('PATCH', `/publico/carrito/items/${idVariante}`, { token: u!.token, cuerpo: { cantidad: 3 } });

    const intentos = await Promise.all(
      Array.from({ length: 10 }, () => s.pedir('POST', '/cliente/checkout/pagos', { token: u!.token, cuerpo: direccion })),
    );
    assert.ok(intentos.every((r) => r.estado === 201), JSON.stringify(intentos.map((r) => r.estado)));
    const ids = new Set(intentos.map((r) => r.datos.IDReserva));
    assert.equal(ids.size, 1);
    const idReserva = intentos[0]!.datos.IDReserva as number;
    assert.equal((await s.pedir('GET', `/cliente/checkout/reservas/${idReserva}`, { token: u!.token })).datos.Estado, 'Activa');
    // Se reservó una sola vez.
    assert.equal((await existencia(idProducto)).Disponible, 7);

    // Repetir después, sin cambios, devuelve la misma reserva y no anula la anterior.
    const otra = await s.pedir('POST', '/cliente/checkout/pagos', { token: u!.token, cuerpo: direccion });
    assert.equal(otra.datos.IDReserva, idReserva);
    assert.equal(otra.datos.Estado, 'Activa');

    // Con otra dirección ya no es un doble clic: se crea otra reserva y la anterior se anula.
    const cambio = await s.pedir('POST', '/cliente/checkout/pagos', { token: u!.token, cuerpo: { ...direccion, direccion: 'Otra dirección 1-1' } });
    assert.notEqual(cambio.datos.IDReserva, idReserva);
    assert.equal((await s.pedir('GET', `/cliente/checkout/reservas/${idReserva}`, { token: u!.token })).datos.Estado, 'Anulada');
    assert.equal((await existencia(idProducto)).Disponible, 7);
  });

  test('una salida o un ajuste manual no deja la existencia por debajo de lo reservado', async () => {
    const { idProducto, idVariante } = await crearVariante(5);
    const [u] = await usuariosConCarrito(1, idVariante);
    await s.pedir('PATCH', `/publico/carrito/items/${idVariante}`, { token: u!.token, cuerpo: { cantidad: 4 } });
    assert.equal((await s.pedir('POST', '/cliente/checkout/pagos', { token: u!.token, cuerpo: direccion })).estado, 201);

    const mov = (tipo: string, cantidad: number) =>
      s.pedir('POST', '/admin/inventario/movimientos', { token: admin, cuerpo: { idVariante, tipo, cantidad, motivo: 'Prueba reservado' } });
    const salida = await mov('Salida', 2);
    assert.equal(salida.estado, 409);
    assert.match(salida.datos.error.mensaje, /reservadas/);
    assert.equal((await mov('Ajuste', -2)).estado, 409);
    // Solo queda libre 1 unidad: esa sí se puede retirar.
    assert.equal((await mov('Salida', 1)).estado, 201);
    assert.equal((await mov('Ajuste', -1)).estado, 409);
    // Una entrada siempre se acepta.
    assert.equal((await mov('Entrada', 3)).estado, 201);
    const conEntrada = await existencia(idProducto);
    assert.equal(conEntrada.Existencia, 7);
    assert.equal(conEntrada.Disponible, 3);

    // Retiros simultáneos: nunca bajan de lo reservado.
    const intentos = await Promise.all(Array.from({ length: 6 }, () => mov('Salida', 1)));
    assert.equal(intentos.filter((r) => r.estado === 201).length, 3);
    const v = await existencia(idProducto);
    assert.equal(v.Existencia, 4);
    assert.equal(v.Disponible, 0);
  });

  test('cupón con límite total 5: 20 pedidos simultáneos consumen exactamente 5 usos', async () => {
    const codigo = 'LIM' + marca();
    const cupon = await s.pedir('POST', '/admin/cupones', {
      token: admin,
      cuerpo: { codigo, tipo: 'Monto', valor: 10, fechaInicio: '2026-01-01T00:00:00Z', fechaFin: '2030-01-01T00:00:00Z', limiteTotal: 5, limitePorCliente: 1 },
    });
    assert.equal(cupon.estado, 201);
    const { idVariante } = await crearVariante(50);
    const usuarios = await usuariosConCarrito(20, idVariante);

    // Todos reservan con el cupón (la validación aún no consume el uso).
    const reservas = await Promise.all(
      usuarios.map((u) => s.pedir('POST', '/cliente/checkout/pagos', { token: u.token, cuerpo: { ...direccion, codigoCupon: codigo } })),
    );
    assert.ok(reservas.every((r) => r.estado === 201));

    // Pagan todos a la vez: el límite se respeta con concurrencia.
    const pedidos = await Promise.all(
      usuarios.map((u, i) => s.pedir('POST', `/cliente/checkout/reservas/${reservas[i]!.datos.IDReserva}/pedido`, { token: u.token })),
    );
    const ok = pedidos.filter((p) => p.estado === 201);
    const rechazados = pedidos.filter((p) => p.estado === 409);
    assert.equal(ok.length, 5);
    assert.equal(rechazados.length, 15);
    assert.match(rechazados[0]!.datos.error.mensaje, /límite total/);
    assert.ok(ok.every((p) => p.datos.Descuento === 10 && p.datos.Total === 90));

    let usos: number | undefined;
    for (let pag = 1; usos === undefined && pag <= 10; pag++) {
      const r = await s.pedir('GET', `/admin/cupones?tamano=100&pagina=${pag}`, { token: admin });
      usos = r.datos.datos.find((c: { Codigo: string }) => c.Codigo === codigo)?.Usos;
    }
    assert.equal(usos, 5);

    // Cancelar un pedido devuelve el uso, y entonces cabe uno más.
    const ganador = usuarios.findIndex((_, i) => pedidos[i]!.estado === 201);
    await s.pedir('PATCH', `/cliente/pedidos/${pedidos[ganador]!.datos.IDPedido}/estado`, { token: usuarios[ganador]!.token, cuerpo: { estado: 'Cancelado' } });
    const perdedor = usuarios.findIndex((_, i) => pedidos[i]!.estado === 409);
    const reintento = await s.pedir('POST', `/cliente/checkout/reservas/${reservas[perdedor]!.datos.IDReserva}/pedido`, { token: usuarios[perdedor]!.token });
    assert.equal(reintento.estado, 201);
  });

  test('cupón con límite por cliente: un mismo cliente no lo usa dos veces en paralelo', async () => {
    const codigo = 'CLI' + marca();
    await s.pedir('POST', '/admin/cupones', {
      token: admin,
      cuerpo: { codigo, tipo: 'Porcentaje', valor: 10, fechaInicio: '2026-01-01T00:00:00Z', fechaFin: '2030-01-01T00:00:00Z', limitePorCliente: 1 },
    });
    const { idVariante } = await crearVariante(20);
    const [u] = await usuariosConCarrito(1, idVariante);
    const reserva = await s.pedir('POST', '/cliente/checkout/pagos', { token: u!.token, cuerpo: { ...direccion, codigoCupon: codigo } });
    assert.equal(reserva.estado, 201);
    const pedido = await s.pedir('POST', `/cliente/checkout/reservas/${reserva.datos.IDReserva}/pedido`, { token: u!.token });
    assert.equal(pedido.estado, 201);

    await s.pedir('POST', '/publico/carrito/items', { token: u!.token, cuerpo: { idVariante, cantidad: 1 } });
    const segundo = await s.pedir('POST', '/cliente/checkout/pagos', { token: u!.token, cuerpo: { ...direccion, codigoCupon: codigo } });
    assert.equal(segundo.estado, 409);
    assert.match(segundo.datos.error.mensaje, /máximo de veces/);
  });
});
