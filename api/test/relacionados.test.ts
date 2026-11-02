import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { hayBase, iniciarServidor } from './ayuda.js';

// Cada prueba usa una categoría propia, porque las demás pruebas agregan productos a las de semilla.
describe('productos relacionados', { skip: !hayBase && 'sin conexión a la base' }, () => {
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

  async function crearCategoria() {
    const c = await s.pedir('POST', '/categorias', { token: admin, cuerpo: { nombre: 'Rel ' + marca() } });
    return c.datos.IDCategoria as number;
  }

  async function crearProducto(idCategoria: number) {
    const nombre = 'Relacionado ' + marca();
    const p = await s.pedir('POST', '/productos', { token: admin, cuerpo: { idCategoria, nombre } });
    await s.pedir('POST', `/productos/${p.datos.IDProducto}/variantes`, {
      token: admin,
      cuerpo: { sku: 'REL-' + marca(), precio: 25, existenciaInicial: 5 },
    });
    return { id: p.datos.IDProducto as number, nombre };
  }

  const ids = (lista: { IDProducto: number }[]) => lista.map((p) => p.IDProducto);

  test('primero la misma categoría, luego otras, sin el producto actual y con tope de 12', async () => {
    const idCategoria = await crearCategoria();
    const actual = await crearProducto(idCategoria);
    const hermanos = [await crearProducto(idCategoria), await crearProducto(idCategoria)];

    const r = await s.pedir('GET', `/productos/${actual.id}/relacionados`);
    assert.equal(r.estado, 200);
    assert.equal(r.datos.length, 12);
    assert.ok(!ids(r.datos).includes(actual.id));
    assert.deepEqual(new Set(ids(r.datos.slice(0, 2))), new Set(hermanos.map((h) => h.id)));
    assert.ok(r.datos.slice(2).every((p: { IDCategoria: number }) => p.IDCategoria !== idCategoria));
    assert.equal(new Set(ids(r.datos)).size, 12);
  });

  test('tiene la misma forma que una tarjeta del listado', async () => {
    const idCategoria = await crearCategoria();
    const actual = await crearProducto(idCategoria);
    const hermano = await crearProducto(idCategoria);

    const relacionado = (await s.pedir('GET', `/productos/${actual.id}/relacionados`)).datos[0];
    const listado = (await s.pedir('GET', `/productos?idCategoria=${idCategoria}&texto=${encodeURIComponent(hermano.nombre)}`)).datos.datos[0];
    assert.deepEqual(relacionado, listado);
  });

  test('solo muestra productos activos, con variantes activas y de categorías activas', async () => {
    const idCategoria = await crearCategoria();
    const actual = await crearProducto(idCategoria);

    const inactivo = await crearProducto(idCategoria);
    await s.pedir('PUT', `/productos/${inactivo.id}`, { token: admin, cuerpo: { idCategoria, nombre: inactivo.nombre, activo: false } });
    const sinVariantes = await s.pedir('POST', '/productos', { token: admin, cuerpo: { idCategoria, nombre: 'Relacionado sin variantes ' + marca() } });

    const otraCategoria = await crearCategoria();
    const otro = await crearProducto(otraCategoria);
    const nombre = 'Rel inactiva ' + marca();
    await s.pedir('PUT', `/categorias/${otraCategoria}`, { token: admin, cuerpo: { nombre, activa: false } });

    const r = await s.pedir('GET', `/productos/${actual.id}/relacionados`);
    for (const oculto of [inactivo.id, sinVariantes.datos.IDProducto as number, otro.id]) {
      assert.ok(!ids(r.datos).includes(oculto));
    }
  });

  test('producto inexistente o inactivo responde 404 al público', async () => {
    assert.equal((await s.pedir('GET', '/productos/2147483647/relacionados')).estado, 404);
    assert.equal((await s.pedir('GET', '/productos/abc/relacionados')).estado, 400);

    const idCategoria = await crearCategoria();
    const inactivo = await crearProducto(idCategoria);
    await s.pedir('PUT', `/productos/${inactivo.id}`, { token: admin, cuerpo: { idCategoria, nombre: inactivo.nombre, activo: false } });
    assert.equal((await s.pedir('GET', `/productos/${inactivo.id}/relacionados`)).estado, 404);
    assert.equal((await s.pedir('GET', `/productos/${inactivo.id}/relacionados`, { token: admin })).estado, 200);
  });
});
