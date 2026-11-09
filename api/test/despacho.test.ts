import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { direccion, hayBase, iniciarServidor } from './ayuda.js';

// Datos de despacho y entrega del pedido. Cada prueba crea su propio pedido, con un
// producto propio para no depender de la existencia que usan las demás pruebas.
describe('despacho y entrega del pedido', { skip: !hayBase && 'sin conexión a la base' }, () => {
  let s: Awaited<ReturnType<typeof iniciarServidor>>;
  let admin = '', operador = '';
  let idVariante = 0;
  const envio = { mensajeria: 'Mensajería Central', guia: 'GUIA-1001', pesoKg: 2.35, costoRecogida: 35.5 };

  before(async () => {
    s = await iniciarServidor();
    admin = await s.loginAdmin('admin@shopcart.test', 'Admin123!');
    operador = await s.loginAdmin('operador@shopcart.test', 'Operador123!');

    const marca = `${Date.now()}`;
    const cat = await s.pedir('POST', '/admin/categorias', { token: admin, cuerpo: { nombre: 'Despacho ' + marca } });
    const prod = await s.pedir('POST', '/admin/productos', { token: admin, cuerpo: { idCategoria: cat.datos.IDCategoria, nombre: 'Producto despacho ' + marca } });
    const vari = await s.pedir('POST', `/admin/productos/${prod.datos.IDProducto}/variantes`, {
      token: admin,
      cuerpo: { sku: 'DESP-' + marca, precio: 100, existenciaInicial: 50 },
    });
    idVariante = vari.datos.variantes[0].IDVariante as number;
  });
  after(async () => {
    await s.cerrar();
  });

  async function crearPedido() {
    const c = await s.registrar('desp');
    await s.pedir('POST', '/publico/carrito/items', { token: c.token, cuerpo: { idVariante, cantidad: 1 } });
    const reserva = await s.pedir('POST', '/cliente/checkout/pagos', { token: c.token, cuerpo: direccion });
    const pedido = await s.pedir('POST', `/cliente/checkout/reservas/${reserva.datos.IDReserva}/pedido`, { token: c.token });
    assert.equal(pedido.estado, 201, JSON.stringify(pedido.datos));
    return { idPedido: pedido.datos.IDPedido as number, cliente: c.token };
  }

  const cambiar = (idPedido: number, cuerpo: object, token = operador) => s.pedir('PATCH', `/admin/pedidos/${idPedido}/estado`, { token, cuerpo });
  const detalle = (idPedido: number) => s.pedir('GET', `/admin/pedidos/${idPedido}`, { token: operador });

  async function enPreparacion() {
    const p = await crearPedido();
    assert.equal((await cambiar(p.idPedido, { estado: 'EnPreparacion' })).estado, 200);
    return p;
  }

  async function despachado() {
    const p = await enPreparacion();
    assert.equal((await cambiar(p.idPedido, { estado: 'Despachado', ...envio })).estado, 200);
    return p;
  }

  test('despachar sin los datos del envío responde 400 y el pedido no avanza', async () => {
    const { idPedido } = await enPreparacion();

    assert.equal((await cambiar(idPedido, { estado: 'Despachado' })).estado, 400);
    for (const campo of Object.keys(envio)) {
      const incompleto: Record<string, unknown> = { estado: 'Despachado', ...envio };
      delete incompleto[campo];
      assert.equal((await cambiar(idPedido, incompleto)).estado, 400, campo);
    }
    assert.equal((await cambiar(idPedido, { estado: 'Despachado', ...envio, pesoKg: 0 })).estado, 400);
    assert.equal((await cambiar(idPedido, { estado: 'Despachado', ...envio, costoRecogida: -1 })).estado, 400);
    assert.equal((await cambiar(idPedido, { estado: 'Despachado', ...envio, guia: '   ' })).estado, 400);

    const d = await detalle(idPedido);
    assert.equal(d.datos.Estado, 'EnPreparacion');
    assert.equal(d.datos.envio, null);
  });

  test('despachar con los datos los guarda y administración los ve todos', async () => {
    const { idPedido } = await enPreparacion();

    const r = await cambiar(idPedido, { estado: 'Despachado', ...envio, costoRecogida: 0 });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    assert.equal(r.datos.Estado, 'Despachado');

    const e = (await detalle(idPedido)).datos.envio;
    assert.equal(e.Mensajeria, envio.mensajeria);
    assert.equal(e.Guia, envio.guia);
    assert.equal(e.PesoKg, envio.pesoKg);
    assert.equal(e.CostoRecogida, 0);
    assert.ok(e.FechaDespacho);
    assert.equal(e.RecibidoPor, null);
    assert.equal(e.FechaEntrega, null);
  });

  test('entregar sin quién recibió responde 400 y el pedido no avanza', async () => {
    const { idPedido } = await despachado();

    assert.equal((await cambiar(idPedido, { estado: 'Entregado' })).estado, 400);
    assert.equal((await cambiar(idPedido, { estado: 'Entregado', recibidoPor: '  ' })).estado, 400);

    const d = await detalle(idPedido);
    assert.equal(d.datos.Estado, 'Despachado');
    assert.equal(d.datos.envio.RecibidoPor, null);
  });

  test('entregar guarda quién recibió y la fecha de entrega', async () => {
    const { idPedido } = await despachado();

    const r = await cambiar(idPedido, { estado: 'Entregado', recibidoPor: 'Ana López' });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    assert.equal(r.datos.Estado, 'Entregado');
    assert.equal(r.datos.envio.RecibidoPor, 'Ana López');
    assert.ok(r.datos.envio.FechaEntrega);
    assert.equal(r.datos.envio.Guia, envio.guia);
  });

  test('el cliente ve mensajería, guía, quién recibió y fechas, pero nunca el costo de recogida', async () => {
    const { idPedido, cliente } = await despachado();
    await cambiar(idPedido, { estado: 'Entregado', recibidoPor: 'Ana López' });

    const r = await s.pedir('GET', `/cliente/pedidos/${idPedido}`, { token: cliente });
    assert.equal(r.estado, 200);
    assert.equal(r.datos.envio.Mensajeria, envio.mensajeria);
    assert.equal(r.datos.envio.Guia, envio.guia);
    assert.equal(r.datos.envio.PesoKg, envio.pesoKg);
    assert.equal(r.datos.envio.RecibidoPor, 'Ana López');
    assert.ok(r.datos.envio.FechaDespacho);
    assert.ok(r.datos.envio.FechaEntrega);
    assert.ok(!JSON.stringify(r.datos).includes('CostoRecogida'));
  });

  test('sin pedidos.gestionar no se puede despachar', async () => {
    const { idPedido } = await enPreparacion();
    const marca = `${Date.now() % 1000000000}${Math.floor(Math.random() * 1000)}`;
    const rol = await s.admin('POST', '/admin/roles', { token: admin, cuerpo: { nombre: 'R' + marca, descripcion: 'Rol de prueba', permisos: ['pedidos.ver'] } });
    assert.equal(rol.estado, 201, JSON.stringify(rol.datos));
    const correo = `desp-${marca}@shopcart.test`;
    await s.admin('POST', '/admin/usuarios', { token: admin, cuerpo: { correo, clave: 'Prueba-123456', nombre: 'Solo mira', rol: rol.datos.Nombre } });
    const mira = await s.loginAdmin(correo, 'Prueba-123456');

    assert.equal((await cambiar(idPedido, { estado: 'Despachado', ...envio }, mira)).estado, 403);
    assert.equal((await detalle(idPedido)).datos.Estado, 'EnPreparacion');
  });

  test('cancelar sigue funcionando y no necesita datos de envío', async () => {
    const delCliente = await crearPedido();
    const r = await s.pedir('PATCH', `/cliente/pedidos/${delCliente.idPedido}/estado`, { token: delCliente.cliente, cuerpo: { estado: 'Cancelado', comentario: 'Ya no lo necesito' } });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    assert.equal(r.datos.Estado, 'Cancelado');

    // En otras transiciones los datos de envío se ignoran, como cualquier campo desconocido.
    const delOperador = await enPreparacion();
    const c = await cambiar(delOperador.idPedido, { estado: 'Cancelado', ...envio });
    assert.equal(c.estado, 200, JSON.stringify(c.datos));
    assert.equal(c.datos.envio, null);
  });

  test('una transición inválida se sigue rechazando con 409 aunque lleve los datos', async () => {
    const { idPedido } = await crearPedido();
    assert.equal((await cambiar(idPedido, { estado: 'Despachado', ...envio })).estado, 409);
    assert.equal((await cambiar(idPedido, { estado: 'Entregado', recibidoPor: 'Ana López' })).estado, 409);

    const d = await despachado();
    assert.equal((await s.pedir('PATCH', `/cliente/pedidos/${d.idPedido}/estado`, { token: d.cliente, cuerpo: { estado: 'Cancelado' } })).estado, 409);
    assert.equal((await cambiar(d.idPedido, { estado: 'Despachado', ...envio, guia: 'OTRA' })).estado, 409);
    assert.equal((await detalle(d.idPedido)).datos.envio.Guia, envio.guia);
  });
});
