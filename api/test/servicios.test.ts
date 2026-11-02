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

  test('/api/salud identifica al servicio que respondió', async () => {
    assert.deepEqual((await s.tienda('GET', '/salud')).datos, { estado: 'ok', servicio: 'tienda' });
    assert.deepEqual((await s.admin('GET', '/salud')).datos, { estado: 'ok', servicio: 'admin' });
  });
});
