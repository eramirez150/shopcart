import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { iniciarServidor } from './ayuda.js';

// Cada servicio expone solo sus rutas. Estas pruebas no tocan la base.
describe('separación de servicios', () => {
  let s: Awaited<ReturnType<typeof iniciarServidor>>;
  before(async () => {
    s = await iniciarServidor();
  });
  after(async () => {
    await s.cerrar();
  });

  test('la tienda responde 404 en las rutas de administración', async () => {
    for (const ruta of ['/admin/productos', '/admin/usuarios', '/admin/dashboard/ventas']) {
      assert.equal((await s.tienda('GET', ruta)).estado, 404, ruta);
    }
    assert.equal((await s.tienda('POST', '/admin/auth/login', { cuerpo: {} })).estado, 404);
  });

  test('administración responde 404 en las rutas públicas y de cliente', async () => {
    for (const ruta of ['/publico/productos', '/publico/categorias', '/publico/carrito', '/cliente/pedidos', '/cliente/direcciones']) {
      assert.equal((await s.admin('GET', ruta)).estado, 404, ruta);
    }
    assert.equal((await s.admin('POST', '/publico/auth/login', { cuerpo: {} })).estado, 404);
    assert.equal((await s.admin('POST', '/publico/auth/registro', { cuerpo: {} })).estado, 404);
  });

  test('las rutas anteriores ya no existen en ningún servicio', async () => {
    for (const ruta of ['/productos', '/categorias', '/carrito', '/pedidos', '/usuarios', '/inventario/existencias', '/bitacora']) {
      assert.equal((await s.tienda('GET', ruta)).estado, 404, ruta);
      assert.equal((await s.admin('GET', ruta)).estado, 404, ruta);
    }
  });

  test('administración no tiene registro y sus rutas privadas exigen sesión', async () => {
    assert.equal((await s.admin('POST', '/admin/auth/registro', { cuerpo: {} })).estado, 404);
    for (const ruta of ['/admin/productos', '/admin/usuarios', '/admin/cupones', '/admin/pedidos', '/admin/inventario/existencias', '/admin/bitacora']) {
      assert.equal((await s.admin('GET', ruta)).estado, 401, ruta);
    }
  });

  test('las rutas de cliente de la tienda exigen sesión', async () => {
    for (const ruta of ['/cliente/pedidos', '/cliente/direcciones', '/cliente/checkout/reservas/1']) {
      assert.equal((await s.tienda('GET', ruta)).estado, 401, ruta);
    }
  });

  const preflight = (base: string, origen: string, cabeceras = 'authorization') =>
    fetch(base + '/salud', {
      method: 'OPTIONS',
      headers: { origin: origen, 'access-control-request-method': 'POST', 'access-control-request-headers': cabeceras },
    });
  const TIENDA = 'http://localhost:5173';
  const ADMIN = 'http://localhost:5174';

  test('CORS: cada servicio acepta su origen con métodos y cabeceras explícitos', async () => {
    const tienda = await preflight(s.base, TIENDA);
    assert.equal(tienda.status, 204);
    assert.equal(tienda.headers.get('access-control-allow-origin'), TIENDA);
    assert.equal(tienda.headers.get('access-control-allow-methods'), 'GET,POST,PUT,PATCH,DELETE');
    assert.match(tienda.headers.get('access-control-allow-headers')!, /X-Carrito-Token/);

    const admin = await preflight(s.baseAdmin, ADMIN);
    assert.equal(admin.status, 204);
    assert.equal(admin.headers.get('access-control-allow-origin'), ADMIN);
    assert.equal(admin.headers.get('access-control-allow-methods'), 'GET,POST,PUT,PATCH,DELETE');
    assert.doesNotMatch(admin.headers.get('access-control-allow-headers')!, /X-Carrito-Token/);
  });

  test('CORS: un origen ajeno no recibe ninguna cabecera de permiso', async () => {
    const casos: [string, string][] = [
      [s.base, 'http://sitio-malo.test'],
      [s.base, ADMIN],
      [s.baseAdmin, 'http://sitio-malo.test'],
      [s.baseAdmin, TIENDA],
    ];
    for (const [base, origen] of casos) {
      const r = await preflight(base, origen);
      for (const cabecera of ['allow-origin', 'allow-methods', 'allow-headers']) {
        assert.equal(r.headers.get('access-control-' + cabecera), null, `${origen} ${cabecera}`);
      }
      const simple = await fetch(base + '/salud', { headers: { origin: origen } });
      assert.equal(simple.headers.get('access-control-allow-origin'), null, origen);
    }
  });

  test('cada servicio documenta solo sus rutas en /api/docs', async () => {
    const documento = async (base: string) => (await fetch(base + '/docs/swagger-ui-init.js')).text();
    const tienda = await documento(s.base);
    const admin = await documento(s.baseAdmin);

    assert.match(tienda, /"\/publico\/productos"/);
    assert.match(tienda, /"\/cliente\/pedidos"/);
    assert.doesNotMatch(tienda, /"\/admin\//);
    assert.match(admin, /"\/admin\/roles"/);
    assert.match(admin, /"\/admin\/auth\/login"/);
    assert.doesNotMatch(admin, /"\/(publico|cliente)\//);
  });

  test('/api/salud identifica al servicio que respondió', async () => {
    assert.deepEqual((await s.tienda('GET', '/salud')).datos, { estado: 'ok', servicio: 'tienda' });
    assert.deepEqual((await s.admin('GET', '/salud')).datos, { estado: 'ok', servicio: 'admin' });
  });
});
