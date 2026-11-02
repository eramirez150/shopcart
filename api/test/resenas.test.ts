import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { direccion, hayBase, iniciarServidor } from './ayuda.js';

// Reseñas: solo un Cliente con un pedido Entregado que contenga el producto, una por producto.
describe('reseñas de producto', { skip: !hayBase && 'sin conexión a la base' }, () => {
  let s: Awaited<ReturnType<typeof iniciarServidor>>;
  let admin = '';
  let operador = '';
  before(async () => {
    s = await iniciarServidor();
    admin = await s.loginAdmin('admin@shopcart.test', 'Admin123!');
    operador = await s.loginAdmin('operador@shopcart.test', 'Operador123!');
  });
  after(async () => {
    await s.cerrar();
  });

  const marca = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  async function crearProducto() {
    const p = await s.pedir('POST', '/admin/productos', { token: admin, cuerpo: { idCategoria: 3, nombre: 'Reseñable ' + marca() } });
    const v = await s.pedir('POST', `/admin/productos/${p.datos.IDProducto}/variantes`, {
      token: admin,
      cuerpo: { sku: 'RES-' + marca(), precio: 50, existenciaInicial: 20 },
    });
    return { idProducto: p.datos.IDProducto as number, idVariante: v.datos.variantes[0].IDVariante as number };
  }

  async function comprar(token: string, idVariante: number) {
    await s.pedir('POST', '/publico/carrito/items', { token, cuerpo: { idVariante, cantidad: 1 } });
    const reserva = await s.pedir('POST', '/cliente/checkout/pagos', { token, cuerpo: direccion });
    assert.equal(reserva.estado, 201, JSON.stringify(reserva.datos));
    const pedido = await s.pedir('POST', `/cliente/checkout/reservas/${reserva.datos.IDReserva}/pedido`, { token });
    assert.equal(pedido.estado, 201, JSON.stringify(pedido.datos));
    return pedido.datos.IDPedido as number;
  }

  async function entregar(idPedido: number) {
    for (const estado of ['EnPreparacion', 'Despachado', 'Entregado']) {
      const r = await s.pedir('PATCH', `/admin/pedidos/${idPedido}/estado`, { token: operador, cuerpo: { estado } });
      assert.equal(r.estado, 200, JSON.stringify(r.datos));
    }
  }

  async function clienteConEntrega(idVariante: number, prefijo: string) {
    const c = await s.registrar(prefijo);
    await entregar(await comprar(c.token, idVariante));
    return c;
  }

  const resena = { calificacion: 4, comentario: 'Cumple con lo que promete.' };

  test('crear: exige sesión de Cliente y un pedido Entregado con ese producto', async () => {
    const { idProducto, idVariante } = await crearProducto();
    const ruta = `/cliente/productos/${idProducto}/resenas`;
    const publica = `/publico/productos/${idProducto}/resenas`;
    const c = await s.registrar('compra');

    assert.equal((await s.pedir('POST', ruta, { cuerpo: resena })).estado, 401);
    // El token de administración no sirve en la tienda: el personal no reseña.
    assert.equal((await s.pedir('POST', ruta, { token: operador, cuerpo: resena })).estado, 401);

    const sinCompra = await s.pedir('POST', ruta, { token: c.token, cuerpo: resena });
    assert.equal(sinCompra.estado, 403);
    assert.equal(sinCompra.datos.error.codigo, 'RESENA_SIN_COMPRA');

    // Un pedido pagado todavía no cuenta: tiene que estar entregado.
    const idPedido = await comprar(c.token, idVariante);
    const pagado = await s.pedir('POST', ruta, { token: c.token, cuerpo: resena });
    assert.equal(pagado.estado, 403);
    assert.equal(pagado.datos.error.codigo, 'RESENA_SIN_COMPRA');

    await entregar(idPedido);
    const creada = await s.pedir('POST', ruta, { token: c.token, cuerpo: resena });
    assert.equal(creada.estado, 201, JSON.stringify(creada.datos));
    assert.deepEqual(Object.keys(creada.datos).sort(), ['Autor', 'Calificacion', 'Comentario', 'Fecha', 'IDResena']);
    assert.equal(creada.datos.Autor, 'Prueba C.');
    assert.equal(creada.datos.Calificacion, 4);
    assert.equal(creada.datos.Comentario, resena.comentario);

    const repetida = await s.pedir('POST', ruta, { token: c.token, cuerpo: { calificacion: 1, comentario: 'Cambié de opinión' } });
    assert.equal(repetida.estado, 409);
    assert.equal(repetida.datos.error.codigo, 'RESENA_DUPLICADA');
  });

  test('crear: dos envíos simultáneos dejan una sola reseña', async () => {
    const { idProducto, idVariante } = await crearProducto();
    const c = await clienteConEntrega(idVariante, 'doble');
    const ruta = `/cliente/productos/${idProducto}/resenas`;
    const publica = `/publico/productos/${idProducto}/resenas`;

    const r = await Promise.all([1, 2, 3].map(() => s.pedir('POST', ruta, { token: c.token, cuerpo: resena })));
    assert.deepEqual(r.map((x) => x.estado).sort(), [201, 409, 409]);
    assert.equal((await s.pedir('GET', publica)).datos.total, 1);
  });

  test('crear: valida la calificación, el comentario y el producto', async () => {
    const { idProducto, idVariante } = await crearProducto();
    const c = await clienteConEntrega(idVariante, 'valida');
    const ruta = `/cliente/productos/${idProducto}/resenas`;
    const publica = `/publico/productos/${idProducto}/resenas`;

    for (const cuerpo of [
      { calificacion: 0, comentario: 'Bajo' },
      { calificacion: 6, comentario: 'Alto' },
      { calificacion: 3.5, comentario: 'Con decimales' },
      { calificacion: 3, comentario: '   ' },
      { calificacion: 3, comentario: 'x'.repeat(1001) },
      { comentario: 'Sin calificación' },
    ]) {
      assert.equal((await s.pedir('POST', ruta, { token: c.token, cuerpo })).estado, 400, JSON.stringify(cuerpo).slice(0, 60));
    }
    assert.equal((await s.pedir('POST', '/cliente/productos/2147483647/resenas', { token: c.token, cuerpo: resena })).estado, 404);
    assert.equal((await s.pedir('POST', '/cliente/productos/abc/resenas', { token: c.token, cuerpo: resena })).estado, 400);
    assert.equal((await s.pedir('POST', ruta, { token: c.token, cuerpo: { calificacion: 5, comentario: 'x'.repeat(1000) } })).estado, 201);
  });

  test('listar: público, paginado, recientes primero, con promedio y total, sin datos del usuario', async () => {
    const { idProducto, idVariante } = await crearProducto();
    const ruta = `/cliente/productos/${idProducto}/resenas`;
    const publica = `/publico/productos/${idProducto}/resenas`;

    const vacia = await s.pedir('GET', publica);
    assert.equal(vacia.estado, 200);
    assert.deepEqual([vacia.datos.total, vacia.datos.promedio, vacia.datos.datos], [0, null, []]);

    const notas = [5, 4, 4];
    for (const [i, calificacion] of notas.entries()) {
      const c = await clienteConEntrega(idVariante, 'lista');
      const r = await s.pedir('POST', ruta, { token: c.token, cuerpo: { calificacion, comentario: `Opinión ${i}` } });
      assert.equal(r.estado, 201);
    }

    const primera = await s.pedir('GET', `${publica}?tamano=2`);
    assert.equal(primera.estado, 200);
    assert.deepEqual([primera.datos.total, primera.datos.pagina, primera.datos.tamano], [3, 1, 2]);
    assert.equal(primera.datos.promedio, 4.33);
    assert.deepEqual(primera.datos.datos.map((r: { Comentario: string }) => r.Comentario), ['Opinión 2', 'Opinión 1']);
    for (const fila of primera.datos.datos) {
      assert.deepEqual(Object.keys(fila).sort(), ['Autor', 'Calificacion', 'Comentario', 'Fecha', 'IDResena']);
    }
    assert.ok(!/@|IDUsuario|Correo/.test(JSON.stringify(primera.datos)));

    const segunda = await s.pedir('GET', `${publica}?tamano=2&pagina=2`);
    assert.deepEqual(segunda.datos.datos.map((r: { Comentario: string }) => r.Comentario), ['Opinión 0']);

    // Una página sin filas conserva el resumen.
    const lejos = await s.pedir('GET', `${publica}?tamano=2&pagina=9`);
    assert.deepEqual([lejos.datos.total, lejos.datos.promedio, lejos.datos.datos], [3, 4.33, []]);

    assert.equal((await s.pedir('GET', `${publica}?tamano=101`)).estado, 400);
    assert.equal((await s.pedir('GET', '/publico/productos/2147483647/resenas')).estado, 404);
  });

  test('listar: el nombre público es nombre e inicial del apellido', async () => {
    const { idProducto, idVariante } = await crearProducto();
    const ruta = `/cliente/productos/${idProducto}/resenas`;
    const publica = `/publico/productos/${idProducto}/resenas`;

    async function autorDe(nombre: string) {
      const correo = `autor-${marca()}@shopcart.test`;
      const r = await s.pedir('POST', '/publico/auth/registro', { cuerpo: { correo, clave: 'Prueba-123456', nombre } });
      assert.equal(r.estado, 201, JSON.stringify(r.datos));
      const token = r.datos.accessToken as string;
      await entregar(await comprar(token, idVariante));
      return (await s.pedir('POST', ruta, { token, cuerpo: resena })).datos.Autor as string;
    }

    assert.equal(await autorDe('Lucía   ávila Reyes'), 'Lucía Á.');
    assert.equal(await autorDe('Madonna'), 'Madonna');
    assert.equal(await autorDe('alguien@correo.test'), 'Cliente');
  });

  test('permiso: indica si el usuario actual puede reseñar y por qué no', async () => {
    const { idProducto, idVariante } = await crearProducto();
    const ruta = `/cliente/productos/${idProducto}/resenas/permiso`;

    assert.equal((await s.pedir('GET', ruta)).estado, 401);
    assert.equal((await s.pedir('GET', ruta, { token: operador })).estado, 401);

    const c = await s.registrar('permiso');
    assert.deepEqual((await s.pedir('GET', ruta, { token: c.token })).datos, { puede: false, motivo: 'SinCompra' });

    await entregar(await comprar(c.token, idVariante));
    assert.deepEqual((await s.pedir('GET', ruta, { token: c.token })).datos, { puede: true, motivo: null });

    await s.pedir('POST', `/cliente/productos/${idProducto}/resenas`, { token: c.token, cuerpo: resena });
    assert.deepEqual((await s.pedir('GET', ruta, { token: c.token })).datos, { puede: false, motivo: 'Repetida' });

    assert.equal((await s.pedir('GET', '/cliente/productos/2147483647/resenas/permiso', { token: c.token })).estado, 404);
  });

  test('producto inactivo: sus reseñas se ocultan y no admite nuevas', async () => {
    const { idProducto, idVariante } = await crearProducto();
    const c = await clienteConEntrega(idVariante, 'inactivo');
    const ruta = `/cliente/productos/${idProducto}/resenas`;
    const publica = `/publico/productos/${idProducto}/resenas`;
    const nombre = 'Reseñable inactivo ' + marca();
    await s.pedir('PUT', `/admin/productos/${idProducto}`, { token: admin, cuerpo: { idCategoria: 3, nombre, activo: false } });

    assert.equal((await s.pedir('GET', publica)).estado, 404);
    assert.equal((await s.pedir('POST', ruta, { token: c.token, cuerpo: resena })).estado, 404);
  });

  test('semillas: hay productos con foto y reseñas', async () => {
    const lista = await s.pedir('GET', '/publico/productos?texto=Audífonos');
    const resenas = await s.pedir('GET', `/publico/productos/${lista.datos.datos[0].IDProducto}/resenas`);
    assert.ok(resenas.datos.total >= 2 && resenas.datos.total <= 4);
    assert.ok(resenas.datos.promedio >= 1 && resenas.datos.promedio <= 5);
  });
});
