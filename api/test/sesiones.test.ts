import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { hayBase, iniciarServidor, SECRETO } from './ayuda.js';

const firmar = (audiencia?: string) =>
  jwt.sign({ rol: audiencia === 'admin' ? 'Administrador' : 'Cliente' }, SECRETO, {
    subject: '1',
    expiresIn: 60,
    ...(audiencia && { audience: audiencia }),
  });

// La audiencia se revisa antes de llegar a un stored procedure.
describe('audiencia del token (sin base de datos)', () => {
  let s: Awaited<ReturnType<typeof iniciarServidor>>;
  before(async () => {
    s = await iniciarServidor();
  });
  after(async () => {
    await s.cerrar();
  });

  test('un token de la tienda responde 401 en administración', async () => {
    const r = await s.admin('GET', '/admin/usuarios', { token: firmar('tienda') });
    assert.equal(r.estado, 401);
    assert.equal(r.datos.error.codigo, 'TOKEN_INVALIDO');
  });

  test('un token de administración responde 401 en la tienda', async () => {
    assert.equal((await s.tienda('GET', '/cliente/pedidos', { token: firmar('admin') })).estado, 401);
    assert.equal((await s.tienda('GET', '/publico/carrito', { token: firmar('admin') })).estado, 401);
  });

  test('un token sin audiencia no sirve en ningún servicio', async () => {
    assert.equal((await s.tienda('GET', '/cliente/pedidos', { token: firmar() })).estado, 401);
    assert.equal((await s.admin('GET', '/admin/usuarios', { token: firmar() })).estado, 401);
  });
});

describe('sesiones por servicio', { skip: !hayBase && 'sin conexión a la base' }, () => {
  let s: Awaited<ReturnType<typeof iniciarServidor>>;
  before(async () => {
    s = await iniciarServidor();
  });
  after(async () => {
    await s.cerrar();
  });

  const cliente = { correo: 'cliente@shopcart.test', clave: 'Cliente123!' };
  const operador = { correo: 'operador@shopcart.test', clave: 'Operador123!' };
  const administrador = { correo: 'admin@shopcart.test', clave: 'Admin123!' };

  const loginTienda = (cuerpo: object) => s.tienda('POST', '/publico/auth/login', { cuerpo });
  const loginAdmin = (cuerpo: object) => s.admin('POST', '/admin/auth/login', { cuerpo });

  test('la tienda solo acepta clientes y responde igual que con credenciales malas', async () => {
    const mala = await loginTienda({ correo: cliente.correo, clave: 'incorrecta-1' });
    assert.equal(mala.estado, 401);
    for (const cuerpo of [operador, administrador]) {
      const r = await loginTienda(cuerpo);
      assert.equal(r.estado, 401);
      assert.deepEqual(r.datos, mala.datos);
    }
    const ok = await loginTienda(cliente);
    assert.equal(ok.estado, 200);
    assert.equal(ok.datos.usuario.rol, 'Cliente');
  });

  test('administración rechaza al cliente y responde igual que con credenciales malas', async () => {
    const mala = await loginAdmin({ correo: administrador.correo, clave: 'incorrecta-1' });
    assert.equal(mala.estado, 401);
    const r = await loginAdmin(cliente);
    assert.equal(r.estado, 401);
    assert.deepEqual(r.datos, mala.datos);

    assert.equal((await loginAdmin(operador)).datos.usuario.rol, 'Operador');
    assert.equal((await loginAdmin(administrador)).datos.usuario.rol, 'Administrador');
  });

  test('el token real de un servicio responde 401 en el otro', async () => {
    const tienda = (await loginTienda(cliente)).datos.accessToken as string;
    const admin = (await loginAdmin(administrador)).datos.accessToken as string;
    assert.equal((await s.tienda('GET', '/cliente/pedidos', { token: tienda })).estado, 200);
    assert.equal((await s.admin('GET', '/admin/pedidos', { token: admin })).estado, 200);
    assert.equal((await s.admin('GET', '/admin/pedidos', { token: tienda })).estado, 401);
    assert.equal((await s.tienda('GET', '/cliente/pedidos', { token: admin })).estado, 401);
  });

  test('un refresh token no cruza de servicio ni se quema al intentarlo', async () => {
    const tienda = (await loginTienda(cliente)).datos.refreshToken as string;
    const admin = (await loginAdmin(administrador)).datos.refreshToken as string;

    assert.equal((await s.admin('POST', '/admin/auth/refresh', { cuerpo: { refreshToken: tienda } })).estado, 401);
    assert.equal((await s.tienda('POST', '/publico/auth/refresh', { cuerpo: { refreshToken: admin } })).estado, 401);

    const r1 = await s.tienda('POST', '/publico/auth/refresh', { cuerpo: { refreshToken: tienda } });
    assert.equal(r1.estado, 200);
    assert.equal((await s.tienda('GET', '/cliente/pedidos', { token: r1.datos.accessToken })).estado, 200);
    const r2 = await s.admin('POST', '/admin/auth/refresh', { cuerpo: { refreshToken: admin } });
    assert.equal(r2.estado, 200);
    assert.equal((await s.admin('GET', '/admin/pedidos', { token: r2.datos.accessToken })).estado, 200);
  });

  test('cerrar sesión en un servicio no revoca el token del otro', async () => {
    const tienda = (await loginTienda(cliente)).datos.refreshToken as string;
    assert.equal((await s.admin('POST', '/admin/auth/logout', { cuerpo: { refreshToken: tienda } })).estado, 204);
    assert.equal((await s.tienda('POST', '/publico/auth/refresh', { cuerpo: { refreshToken: tienda } })).estado, 200);
  });
});
