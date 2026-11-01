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

  test('administración: lista productos inactivos y sin variantes que la búsqueda pública oculta', async () => {
    const marca = 'Admin lista ' + Date.now();
    const sinVariantes = await s.pedir('POST', '/productos', { token: admin, cuerpo: { idCategoria: 2, nombre: marca + ' sin variantes' } });
    const inactivo = await s.pedir('POST', '/productos', { token: admin, cuerpo: { idCategoria: 2, nombre: marca + ' inactivo' } });
    await s.pedir('POST', `/productos/${inactivo.datos.IDProducto}/variantes`, {
      token: admin,
      cuerpo: { sku: 'ADM-' + Date.now(), precio: 10, existenciaInicial: 5 },
    });
    await s.pedir('PUT', `/productos/${inactivo.datos.IDProducto}`, { token: admin, cuerpo: { idCategoria: 2, nombre: marca + ' inactivo', activo: false } });

    // La búsqueda pública no muestra ninguno de los dos.
    assert.equal((await s.pedir('GET', `/productos?texto=${encodeURIComponent(marca)}`)).datos.total, 0);

    const ruta = `/productos/administracion?texto=${encodeURIComponent(marca)}`;
    const lista = await s.pedir('GET', ruta, { token: admin });
    assert.equal(lista.estado, 200);
    assert.equal(lista.datos.total, 2);
    const fila = (id: number) => lista.datos.datos.find((p: { IDProducto: number }) => p.IDProducto === id);
    assert.equal(fila(sinVariantes.datos.IDProducto).Variantes, 0);
    assert.equal(fila(sinVariantes.datos.IDProducto).PrecioDesde, null);
    assert.equal(fila(inactivo.datos.IDProducto).Activo, false);
    assert.equal(fila(inactivo.datos.IDProducto).Existencia, 5);

    const soloInactivos = await s.pedir('GET', ruta + '&activo=false', { token: admin });
    assert.deepEqual(soloInactivos.datos.datos.map((p: { IDProducto: number }) => p.IDProducto), [inactivo.datos.IDProducto]);

    const cliente = await s.registrar('adm');
    assert.equal((await s.pedir('GET', ruta, { token: cliente.token })).estado, 403);
    assert.equal((await s.pedir('GET', ruta)).estado, 401);
  });
});
