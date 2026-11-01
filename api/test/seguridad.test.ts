import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { iniciarServidor, SECRETO } from './ayuda.js';

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
    const r = await s.pedir('GET', '/pedidos');
    assert.equal(r.estado, 401);
    assert.equal(r.datos.error.codigo, 'NO_AUTENTICADO');
  });

  test('token expirado responde 401 TOKEN_EXPIRADO', async () => {
    const r = await s.pedir('GET', '/pedidos', { token: s.expirado(3, 'Cliente') });
    assert.equal(r.estado, 401);
    assert.equal(r.datos.error.codigo, 'TOKEN_EXPIRADO');
  });

  test('token con firma ajena responde 401', async () => {
    const falso = jwt.sign({ rol: 'Administrador' }, 'otro-secreto-otro-secreto-otro-secreto', { subject: '1' });
    assert.equal((await s.pedir('GET', '/usuarios', { token: falso })).estado, 401);
  });

  test('rol sin permiso responde 403', async () => {
    const cliente = jwt.sign({ rol: 'Cliente' }, SECRETO, { subject: '3', expiresIn: 60 });
    const operador = jwt.sign({ rol: 'Operador' }, SECRETO, { subject: '2', expiresIn: 60 });
    assert.equal((await s.pedir('GET', '/usuarios', { token: cliente })).estado, 403);
    assert.equal((await s.pedir('GET', '/dashboard/ventas', { token: operador })).estado, 403);
    assert.equal((await s.pedir('POST', '/inventario/movimientos', { token: cliente, cuerpo: {} })).estado, 403);
    assert.equal((await s.pedir('GET', '/bitacora', { token: operador })).estado, 403);
  });

  test('un cliente no puede avanzar un pedido', async () => {
    const cliente = jwt.sign({ rol: 'Cliente' }, SECRETO, { subject: '3', expiresIn: 60 });
    const r = await s.pedir('PATCH', '/pedidos/1/estado', { token: cliente, cuerpo: { estado: 'Despachado' } });
    assert.equal(r.estado, 403);
    // La respuesta sale del manejador central de errores, con su forma de siempre.
    assert.deepEqual(r.datos, { error: { codigo: 'PROHIBIDO', mensaje: 'El cliente solo puede cancelar su pedido' } });
  });

  test('datos inválidos responden 400 con el detalle', async () => {
    const r = await s.pedir('POST', '/auth/registro', { cuerpo: { correo: 'no-es-correo', clave: '123', nombre: '' } });
    assert.equal(r.estado, 400);
    assert.equal(r.datos.error.codigo, 'VALIDACION');
    assert.ok(r.datos.error.detalle.length >= 3);
  });

  test('ruta inexistente responde 404 y JSON mal formado 400', async () => {
    assert.equal((await s.pedir('GET', '/no-existe')).estado, 404);
    const r = await fetch(s.base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{roto' });
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
