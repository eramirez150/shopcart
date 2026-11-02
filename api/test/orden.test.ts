import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { hayBase, iniciarServidor } from './ayuda.js';

// El orden de los listados se resuelve en el servidor (CASE en el SP).
describe('orden en el servidor', { skip: !hayBase && 'sin conexión a la base' }, () => {
  let s: Awaited<ReturnType<typeof iniciarServidor>>;
  let admin = '';
  before(async () => {
    s = await iniciarServidor();
    admin = await s.login('admin@shopcart.test', 'Admin123!');
  });
  after(async () => {
    await s.cerrar();
  });

  const datos = async (ruta: string) => {
    const r = await s.pedir('GET', ruta, { token: admin });
    assert.equal(r.estado, 200, ruta);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return r.datos.datos as Record<string, any>[];
  };
  const ordenado = (valores: (string | number)[], desc = false) => {
    const copia = [...valores].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (desc) copia.reverse();
    assert.deepEqual(valores, copia);
  };
  // Aproxima la intercalación de la base: no distingue mayúsculas ni tildes e ignora guiones.
  const texto = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/-/g, '').toLowerCase();

  test('pedidos por total y por fecha', async () => {
    ordenado((await datos('/admin/pedidos?orden=total_desc&tamano=100')).map((p) => p['Total']), true);
    ordenado((await datos('/admin/pedidos?orden=total_asc&tamano=100')).map((p) => p['Total']));
    ordenado((await datos('/admin/pedidos?orden=antiguos&tamano=100')).map((p) => p['FechaCreacion']));
    ordenado((await datos('/admin/pedidos?tamano=100')).map((p) => p['FechaCreacion']), true);
  });

  test('usuarios, cupones, existencias, kardex y bitácora', async () => {
    ordenado((await datos('/admin/usuarios?orden=nombre&tamano=100')).map((u) => texto(u['Nombre'])));
    ordenado((await datos('/admin/usuarios?orden=recientes&tamano=100')).map((u) => u['IDUsuario']), true);
    ordenado((await datos('/admin/cupones?orden=codigo')).map((c) => texto(c['Codigo'])));
    ordenado((await datos('/admin/cupones?orden=usos')).map((c) => c['Usos']), true);
    ordenado((await datos('/admin/inventario/existencias?orden=disponible_desc&tamano=100')).map((v) => v['Disponible']), true);
    ordenado((await datos('/admin/inventario/existencias?orden=sku&tamano=100')).map((v) => texto(v['SKU'])));
    ordenado((await datos('/admin/inventario/variantes/1/kardex?orden=antiguos')).map((k) => k['IDKardex']));
    ordenado((await datos('/admin/inventario/variantes/1/kardex')).map((k) => k['IDKardex']), true);
    ordenado((await datos('/admin/bitacora?orden=antiguos')).map((b) => b['IDBitacora']));
    ordenado((await datos('/admin/bitacora')).map((b) => b['IDBitacora']), true);
  });

  test('un orden desconocido responde 400', async () => {
    for (const ruta of ['/admin/pedidos?orden=x', '/admin/usuarios?orden=x', '/admin/cupones?orden=x', '/admin/inventario/existencias?orden=x', '/admin/inventario/variantes/1/kardex?orden=x', '/admin/bitacora?orden=x']) {
      assert.equal((await s.pedir('GET', ruta, { token: admin })).estado, 400, ruta);
    }
  });
});
