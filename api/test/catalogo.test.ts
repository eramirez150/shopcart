import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { hayBase, iniciarServidor } from './ayuda.js';

describe('catálogo: imágenes y administración', { skip: !hayBase && 'sin conexión a la base' }, () => {
  let s: Awaited<ReturnType<typeof iniciarServidor>>;
  let admin = '';
  before(async () => {
    s = await iniciarServidor();
    admin = await s.login('admin@shopcart.test', 'Admin123!');
  });
  after(async () => {
    await s.cerrar();
  });

  test('imágenes: las semillas traen una por producto y el Administrador agrega y quita', async () => {
    const busqueda = await s.pedir('GET', '/productos?texto=Licuadora');
    const lic = busqueda.datos.datos[0];
    assert.match(lic.ImagenPrincipal, /^https:\/\//);
    const detalle = await s.pedir('GET', `/productos/${lic.IDProducto}`);
    assert.equal(detalle.datos.imagenes.length, 1);

    const nuevo = await s.pedir('POST', '/productos', { token: admin, cuerpo: { idCategoria: 1, nombre: 'Producto con imágenes ' + Date.now() } });
    const idProducto = nuevo.datos.IDProducto as number;
    assert.deepEqual(nuevo.datos.imagenes, []);

    const ruta = `/productos/${idProducto}/imagenes`;
    assert.equal((await s.pedir('POST', ruta, { token: admin, cuerpo: { url: 'ftp://servidor/foto.jpg' } })).estado, 400);
    const cliente = await s.registrar('img');
    assert.equal((await s.pedir('POST', ruta, { token: cliente.token, cuerpo: { url: 'https://ejemplo.test/a.jpg' } })).estado, 403);

    await s.pedir('POST', ruta, { token: admin, cuerpo: { url: 'https://ejemplo.test/b.jpg', orden: 2 } });
    const conDos = await s.pedir('POST', ruta, { token: admin, cuerpo: { url: 'https://ejemplo.test/a.jpg', textoAlternativo: 'Frente', orden: 1 } });
    assert.equal(conDos.estado, 201);
    assert.deepEqual(conDos.datos.imagenes.map((i: { Url: string }) => i.Url), ['https://ejemplo.test/a.jpg', 'https://ejemplo.test/b.jpg']);

    const idImagen = conDos.datos.imagenes[0].IDProductoImagen as number;
    const sinUna = await s.pedir('DELETE', `/productos/imagenes/${idImagen}`, { token: admin });
    assert.equal(sinUna.datos.imagenes.length, 1);
    assert.equal((await s.pedir('DELETE', `/productos/imagenes/${idImagen}`, { token: admin })).estado, 404);

    // Un producto sin uso se elimina junto con sus imágenes.
    assert.equal((await s.pedir('DELETE', `/productos/${idProducto}`, { token: admin })).datos.Resultado, 'Eliminado');
  });
});
