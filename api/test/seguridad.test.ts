import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { hayBase, iniciarServidor, SECRETO } from './ayuda.js';

// Estas pruebas no tocan la base: fallan antes de llegar a un stored procedure.
describe('seguridad y errores (sin base de datos)', () => {
  let s: Awaited<ReturnType<typeof iniciarServidor>>;
  before(async () => {
    s = await iniciarServidor();
  });
  after(async () => {
    await s.cerrar();
  });

  test('sin token responde 401', async () => {
    const r = await s.pedir('GET', '/cliente/pedidos');
    assert.equal(r.estado, 401);
    assert.equal(r.datos.error.codigo, 'NO_AUTENTICADO');
  });

  test('token expirado responde 401 TOKEN_EXPIRADO', async () => {
    const r = await s.pedir('GET', '/cliente/pedidos', { token: s.expirado(3, 'Cliente') });
    assert.equal(r.estado, 401);
    assert.equal(r.datos.error.codigo, 'TOKEN_EXPIRADO');
  });

  test('token con firma ajena responde 401', async () => {
    const falso = jwt.sign({ rol: 'Administrador' }, 'otro-secreto-otro-secreto-otro-secreto', { subject: '1', audience: 'admin' });
    assert.equal((await s.pedir('GET', '/admin/usuarios', { token: falso })).estado, 401);
  });

  test('un cliente no puede avanzar un pedido', async () => {
    const cliente = jwt.sign({ rol: 'Cliente' }, SECRETO, { subject: '3', audience: 'tienda', expiresIn: 60 });
    const r = await s.pedir('PATCH', '/cliente/pedidos/1/estado', { token: cliente, cuerpo: { estado: 'Despachado' } });
    assert.equal(r.estado, 403);
    // La respuesta sale del manejador central de errores, con su forma de siempre.
    assert.deepEqual(r.datos, { error: { codigo: 'PROHIBIDO', mensaje: 'El cliente solo puede cancelar su pedido' } });
  });

  test('datos inválidos responden 400 con el detalle', async () => {
    const r = await s.pedir('POST', '/publico/auth/registro', { cuerpo: { correo: 'no-es-correo', clave: '123', nombre: '' } });
    assert.equal(r.estado, 400);
    assert.equal(r.datos.error.codigo, 'VALIDACION');
    assert.ok(r.datos.error.detalle.length >= 3);
  });

  test('números fuera del rango de SQL Server responden 400', async () => {
    assert.equal((await s.pedir('GET', '/publico/productos/2147483648')).estado, 400);
    assert.equal((await s.pedir('GET', '/publico/productos?pagina=2147483647')).estado, 400);
    assert.equal((await s.pedir('GET', '/publico/productos?idCategoria=2147483648')).estado, 400);
  });

  test('ruta inexistente responde 404 y JSON mal formado 400', async () => {
    assert.equal((await s.pedir('GET', '/no-existe')).estado, 404);
    const r = await fetch(s.base + '/publico/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{roto' });
    assert.equal(r.status, 400);
  });

  test('cabeceras de seguridad, CORS y documentación Swagger', async () => {
    const r = await fetch(s.base + '/salud', { headers: { origin: 'http://localhost:5173' } });
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-powered-by'), null);
    assert.ok(r.headers.get('content-security-policy'));
    assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const ajena = await fetch(s.base + '/salud', { headers: { origin: 'http://sitio-malo.test' } });
    assert.equal(ajena.headers.get('access-control-allow-origin'), null);
    const docs = await fetch(s.base + '/docs/');
    assert.equal(docs.status, 200);
    assert.match(await docs.text(), /swagger-ui/);
  });
});

// autorizar() consulta el permiso en la base, así que estas pruebas necesitan conexión.
describe('seguridad y errores (con base de datos)', { skip: !hayBase && 'sin conexión a la base' }, () => {
  let s: Awaited<ReturnType<typeof iniciarServidor>>;
  before(async () => {
    s = await iniciarServidor();
  });
  after(async () => {
    await s.cerrar();
  });

  // Tokens de administración de los usuarios de las semillas: 1 Administrador, 2 Operador, 3 Cliente.
  const token = (rol: string, id: number) => jwt.sign({ rol }, SECRETO, { subject: String(id), audience: 'admin', expiresIn: 60 });

  test('rol sin permiso responde 403', async () => {
    const cliente = token('Cliente', 3);
    const operador = token('Operador', 2);
    assert.equal((await s.pedir('GET', '/admin/usuarios', { token: cliente })).estado, 403);
    assert.equal((await s.pedir('GET', '/admin/dashboard/ventas', { token: operador })).estado, 403);
    assert.equal((await s.pedir('POST', '/admin/inventario/movimientos', { token: cliente, cuerpo: {} })).estado, 403);
    assert.equal((await s.pedir('GET', '/admin/bitacora', { token: operador })).estado, 403);
  });

  test('números fuera del rango de SQL Server responden 400', async () => {
    const admin = token('Administrador', 1);
    const movimiento = { idVariante: 1, tipo: 'Entrada', cantidad: 2147483648, motivo: 'Prueba' };
    assert.equal((await s.pedir('POST', '/admin/inventario/movimientos', { token: admin, cuerpo: movimiento })).estado, 400);

    const variante = await s.pedir('POST', '/admin/productos/1/variantes', { token: admin, cuerpo: { sku: 'X', precio: 10000000000 } });
    assert.equal(variante.estado, 400);
    assert.ok(variante.datos.error.detalle.some((d: { campo: string }) => d.campo === 'precio'));
  });
});
