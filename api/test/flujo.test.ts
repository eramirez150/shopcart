import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { direccion, hayBase, iniciarServidor } from './ayuda.js';

// Recorre la API completa contra una base recién sembrada.
describe('flujo completo de compra, pedidos y reportes', { skip: !hayBase && 'sin conexión a la base' }, () => {
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

  // Busca una variante por SKU en el inventario.
  async function porSku(sku: string) {
    const r = await s.pedir('GET', '/inventario/existencias?tamano=100', { token: operador });
    return r.datos.datos.find((v: { SKU: string }) => v.SKU === sku) as { IDVariante: number; Existencia: number; Disponible: number };
  }

  test('catálogo: búsqueda con filtros, orden y paginación', async () => {
    const todos = await s.pedir('GET', '/productos?tamano=10&pagina=2&orden=precio_desc');
    assert.equal(todos.estado, 200);
    assert.equal(todos.datos.datos.length, 10);
    assert.ok(todos.datos.total >= 50);
    const filtrado = await s.pedir('GET', '/productos?precioMin=100&precioMax=200&soloDisponibles=true&orden=precio_asc');
    const precios = filtrado.datos.datos.map((p: { PrecioDesde: number }) => p.PrecioDesde);
    assert.deepEqual(precios, [...precios].sort((a: number, b: number) => a - b));
    assert.ok(precios.length > 0);
    assert.equal((await s.pedir('GET', '/productos?orden=raro')).estado, 400);
  });

  test('registro duplicado 409 y rotación del refresh token', async () => {
    const correo = `rot-${Date.now()}@shopcart.test`;
    const alta = await s.pedir('POST', '/auth/registro', { cuerpo: { correo, clave: 'Prueba-123456', nombre: 'Rota' } });
    assert.equal(alta.estado, 201);
    assert.equal((await s.pedir('POST', '/auth/registro', { cuerpo: { correo, clave: 'Prueba-123456', nombre: 'Rota' } })).estado, 409);
    assert.equal((await s.pedir('POST', '/auth/login', { cuerpo: { correo, clave: 'incorrecta-1' } })).estado, 401);

    const r1 = alta.datos.refreshToken as string;
    const renovado = await s.pedir('POST', '/auth/refresh', { cuerpo: { refreshToken: r1 } });
    assert.equal(renovado.estado, 200);
    assert.notEqual(renovado.datos.refreshToken, r1);
    // Reusar el token viejo es señal de robo: se cierran todas las sesiones.
    assert.equal((await s.pedir('POST', '/auth/refresh', { cuerpo: { refreshToken: r1 } })).estado, 401);
    assert.equal((await s.pedir('POST', '/auth/refresh', { cuerpo: { refreshToken: renovado.datos.refreshToken } })).estado, 401);
  });

  test('un usuario desactivado no puede iniciar sesión', async () => {
    const u = await s.registrar('baja');
    assert.equal((await s.pedir('PATCH', `/usuarios/${u.id}`, { token: admin, cuerpo: { activo: false } })).estado, 200);
    const lista = await s.pedir('GET', '/usuarios?rol=Cliente&tamano=100', { token: admin });
    assert.equal(lista.datos.datos.find((x: { IDUsuario: number }) => x.IDUsuario === u.id).Activo, false);
  });

  test('carrito de invitado, fusión al iniciar sesión, cupón y checkout', async () => {
    const mouse = await porSku('COM-MOU-001');
    const usb = await porSku('COM-USB-64');

    // Invitado: el primer agregado crea el carrito y devuelve su token.
    const g1 = await s.pedir('POST', '/carrito/items', { cuerpo: { idVariante: mouse.IDVariante, cantidad: 2 } });
    assert.equal(g1.estado, 201);
    const token = g1.datos.TokenInvitado as string;
    assert.ok(token);
    const cab = { 'X-Carrito-Token': token };
    const g2 = await s.pedir('POST', '/carrito/items', { cuerpo: { idVariante: usb.IDVariante, cantidad: 1 }, cabeceras: cab });
    assert.equal(Math.round(g2.datos.Subtotal * 100), 24880);
    // No se puede superar el disponible.
    const exceso = await s.pedir('POST', '/carrito/items', { cuerpo: { idVariante: mouse.IDVariante, cantidad: mouse.Disponible + 1 }, cabeceras: cab });
    assert.equal(exceso.estado, 409);

    // Al iniciar sesión el carrito pasa a la cuenta.
    const correo = `flujo-${Date.now()}@shopcart.test`;
    await s.pedir('POST', '/auth/registro', { cuerpo: { correo, clave: 'Prueba-123456', nombre: 'Flujo' } });
    const sesion = await s.pedir('POST', '/auth/login', { cuerpo: { correo, clave: 'Prueba-123456' }, cabeceras: cab });
    const cliente = sesion.datos.accessToken as string;
    const carrito = await s.pedir('GET', '/carrito', { token: cliente });
    assert.equal(carrito.datos.lineas.length, 2);
    assert.equal(carrito.datos.Subtotal, 248.8);

    // Cupones: cada rechazo dice su causa.
    const rechazo = async (codigo: string) => (await s.pedir('PUT', '/carrito/cupon', { token: cliente, cuerpo: { codigo } }));
    assert.equal((await rechazo('NOEXISTE')).estado, 404);
    assert.match((await rechazo('VENCIDO')).datos.error.mensaje, /vencido/);
    assert.match((await rechazo('INACTIVO')).datos.error.mensaje, /desactivado/);
    assert.match((await rechazo('Q50')).datos.error.mensaje, /compra mínima/);
    assert.match((await rechazo('ELECTRO15')).datos.error.mensaje, /categoría/);

    // Con 10 % el total no tiene errores de redondeo.
    const conCupon = await s.pedir('PUT', '/carrito/cupon', { token: cliente, cuerpo: { codigo: 'BIENVENIDA10' } });
    assert.equal(conCupon.datos.Descuento, 24.88);
    assert.equal(conCupon.datos.Total, 223.92);
    const sumaLineas = conCupon.datos.lineas.reduce((a: number, l: { Descuento: number }) => a + l.Descuento, 0);
    assert.equal(Math.round(sumaLineas * 100), 2488);

    // Checkout: reserva 15 minutos y resta del disponible.
    const reserva = await s.pedir('POST', '/checkout/pagos', { token: cliente, cuerpo: direccion });
    assert.equal(reserva.estado, 201);
    assert.equal(reserva.datos.Total, 223.92);
    assert.equal((await porSku('COM-MOU-001')).Disponible, mouse.Disponible - 2);

    // Cambiar el carrito anula la reserva y libera la existencia.
    await s.pedir('PATCH', `/carrito/items/${mouse.IDVariante}`, { token: cliente, cuerpo: { cantidad: 1 } });
    assert.equal((await s.pedir('GET', `/checkout/reservas/${reserva.datos.IDReserva}`, { token: cliente })).datos.Estado, 'Anulada');
    assert.equal((await s.pedir('POST', `/checkout/reservas/${reserva.datos.IDReserva}/pedido`, { token: cliente })).estado, 409);
    assert.equal((await porSku('COM-MOU-001')).Disponible, mouse.Disponible);

    const reserva2 = await s.pedir('POST', '/checkout/pagos', { token: cliente, cuerpo: { ...direccion, codigoCupon: 'BIENVENIDA10' } });
    const idReserva = reserva2.datos.IDReserva as number;
    const p1 = await s.pedir('POST', `/checkout/reservas/${idReserva}/pedido`, { token: cliente });
    const p2 = await s.pedir('POST', `/checkout/reservas/${idReserva}/pedido`, { token: cliente });
    assert.equal(p1.estado, 201);
    assert.equal(p1.datos.IDPedido, p2.datos.IDPedido);
    assert.equal(p1.datos.Estado, 'Pagado');
    const idPedido = p1.datos.IDPedido as number;

    // Un cliente solo ve lo suyo.
    const otro = await s.registrar('ajeno');
    assert.equal((await s.pedir('GET', `/pedidos/${idPedido}`, { token: otro.token })).estado, 404);
    assert.equal((await s.pedir('GET', '/pedidos', { token: otro.token })).datos.total, 0);
    assert.equal((await s.pedir('GET', '/pedidos', { token: cliente })).datos.total, 1);
    // Un cupón BIENVENIDA10 es de un uso por cliente.
    await s.pedir('POST', '/carrito/items', { token: cliente, cuerpo: { idVariante: usb.IDVariante, cantidad: 1 } });
    const repetido = await s.pedir('PUT', '/carrito/cupon', { token: cliente, cuerpo: { codigo: 'BIENVENIDA10' } });
    assert.equal(repetido.estado, 409);
    assert.match(repetido.datos.error.mensaje, /máximo de veces/);

    // Estados: el Operador avanza; las transiciones inválidas se rechazan.
    const estado = (t: string, e: string) => s.pedir('PATCH', `/pedidos/${idPedido}/estado`, { token: t, cuerpo: { estado: e } });
    assert.equal((await estado(operador, 'Entregado')).estado, 409);
    assert.equal((await estado(cliente, 'EnPreparacion')).estado, 403);
    assert.equal((await estado(operador, 'EnPreparacion')).estado, 200);
    assert.equal((await estado(operador, 'Despachado')).estado, 200);
    assert.equal((await estado(cliente, 'Cancelado')).estado, 409);
    assert.equal((await estado(operador, 'Entregado')).datos.Estado, 'Entregado');

    // Devoluciones parcial y total, sin superar lo vendido.
    const detalle = p1.datos.lineas as { IDPedidoDetalle: number; Cantidad: number; SKU: string }[];
    const lMouse = detalle.find((l) => l.SKU === 'COM-MOU-001')!;
    const dev = (cantidad: number, linea = lMouse) =>
      s.pedir('POST', `/pedidos/${idPedido}/devoluciones`, { token: operador, cuerpo: { motivo: 'Defectuoso', lineas: [{ idPedidoDetalle: linea.IDPedidoDetalle, cantidad }] } });
    assert.equal((await dev(5)).estado, 409);
    assert.equal((await s.pedir('POST', `/pedidos/${idPedido}/devoluciones`, { token: cliente, cuerpo: { motivo: 'x', lineas: [{ idPedidoDetalle: 1, cantidad: 1 }] } })).estado, 403);
    assert.equal((await dev(1)).estado, 201);
    assert.equal((await s.pedir('GET', `/pedidos/${idPedido}`, { token: cliente })).datos.Estado, 'DevueltoParcial');
    const dashboardParcial = await s.pedir('GET', '/dashboard/indicadores', { token: admin });
    assert.ok(dashboardParcial.datos.Pedidos >= 1);

    // Existencia = suma del kardex (la última existencia resultante lo confirma).
    const kardex = await s.pedir('GET', `/inventario/variantes/${mouse.IDVariante}/kardex`, { token: operador });
    assert.equal(kardex.datos.datos[0].ExistenciaResultante, (await porSku('COM-MOU-001')).Existencia);
    assert.equal(kardex.datos.datos[0].Tipo, 'Devolucion');

    // Cancelar reintegra la existencia y devuelve el cupón (otro pedido).
    await s.pedir('POST', '/carrito/items', { token: otro.token, cuerpo: { idVariante: usb.IDVariante, cantidad: 3 } });
    const antes = (await porSku('COM-USB-64')).Existencia;
    const r3 = await s.pedir('POST', '/checkout/pagos', { token: otro.token, cuerpo: direccion });
    const ped3 = await s.pedir('POST', `/checkout/reservas/${r3.datos.IDReserva}/pedido`, { token: otro.token });
    assert.equal((await porSku('COM-USB-64')).Existencia, antes - 3);
    assert.equal((await s.pedir('PATCH', `/pedidos/${ped3.datos.IDPedido}/estado`, { token: otro.token, cuerpo: { estado: 'Cancelado' } })).estado, 200);
    assert.equal((await porSku('COM-USB-64')).Existencia, antes);

    // Bitácora: filtro por módulo y solo para Administradores.
    const bit = await s.pedir('GET', '/bitacora?modulo=Pedidos', { token: admin });
    assert.ok(bit.datos.total >= 3);
    assert.ok(bit.datos.datos.every((b: { Modulo: string }) => b.Modulo === 'Pedidos'));
    assert.equal((await s.pedir('GET', '/bitacora', { token: operador })).estado, 403);
  });

  test('dashboard: ventas, categorías, top y carritos abandonados', async () => {
    for (const ruta of ['/dashboard/ventas?agrupacion=Semana', '/dashboard/ventas?agrupacion=Mes', '/dashboard/categorias', '/dashboard/top-productos', '/dashboard/indicadores', '/dashboard/carritos-abandonados?horas=1']) {
      const r = await s.pedir('GET', ruta, { token: admin });
      assert.equal(r.estado, 200, ruta);
    }
    assert.equal((await s.pedir('GET', '/dashboard/ventas?agrupacion=Siglo', { token: admin })).estado, 400);
    assert.equal((await s.pedir('GET', '/dashboard/ventas?desde=2026-12-01&hasta=2026-01-01', { token: admin })).estado, 400);
    const pedidos = await s.pedir('GET', '/pedidos?estado=DevueltoParcial&desde=2026-01-01&totalMin=1', { token: admin });
    assert.equal(pedidos.estado, 200);
  });

  test('catálogo: un producto con ventas se desactiva, uno sin uso se elimina', async () => {
    const nuevo = await s.pedir('POST', '/productos', { token: admin, cuerpo: { idCategoria: 1, nombre: 'Producto de prueba ' + Date.now() } });
    assert.equal(nuevo.estado, 201);
    assert.equal((await s.pedir('DELETE', `/productos/${nuevo.datos.IDProducto}`, { token: admin })).datos.Resultado, 'Eliminado');

    const conVentas = await s.pedir('GET', '/productos?texto=Mouse');
    const id = conVentas.datos.datos[0].IDProducto as number;
    assert.equal((await s.pedir('DELETE', `/productos/${id}`, { token: admin })).datos.Resultado, 'Desactivado');
    assert.equal((await s.pedir('GET', `/productos/${id}`)).estado, 404);
    assert.equal((await s.pedir('GET', `/productos/${id}`, { token: admin })).datos.Activo, false);
  });

  test('inventario: el ajuste exige motivo y no deja la existencia en negativo', async () => {
    const v = await porSku('JUG-PEL-001');
    assert.equal(v.Existencia, 0);
    const mov = (cuerpo: object) => s.pedir('POST', '/inventario/movimientos', { token: operador, cuerpo: { idVariante: v.IDVariante, ...cuerpo } });
    assert.equal((await mov({ tipo: 'Ajuste', cantidad: -1, motivo: 'Merma' })).estado, 409);
    assert.equal((await mov({ tipo: 'Ajuste', cantidad: -1, motivo: ' ' })).estado, 400);
    assert.equal((await mov({ tipo: 'Salida', cantidad: -5, motivo: 'x' })).estado, 400);
    assert.equal((await mov({ tipo: 'Entrada', cantidad: 4, motivo: 'Compra' })).datos.ExistenciaResultante, 4);
    assert.equal((await mov({ tipo: 'Salida', cantidad: 1, motivo: 'Muestra' })).datos.ExistenciaResultante, 3);
  });
});
