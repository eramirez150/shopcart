import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { direccion, hayBase, iniciarServidor } from './ayuda.js';

// El cliente selecciona o registra una dirección y nunca ve ni modifica las de otro.
describe('direcciones de entrega', { skip: !hayBase && 'sin conexión a la base' }, () => {
  let s: Awaited<ReturnType<typeof iniciarServidor>>;
  let operador = '';
  before(async () => {
    s = await iniciarServidor();
    operador = await s.login('operador@shopcart.test', 'Operador123!');
  });
  after(async () => {
    await s.cerrar();
  });

  async function idVariante(sku: string) {
    const r = await s.pedir('GET', '/admin/inventario/existencias?tamano=100&orden=sku', { token: operador });
    return (r.datos.datos as { SKU: string; IDVariante: number }[]).find((v) => v.SKU === sku)!.IDVariante;
  }

  test('propiedad: otro cliente no ve, no modifica, no desactiva ni usa la dirección ajena', async () => {
    const a = await s.registrar('dir-a');
    const b = await s.registrar('dir-b');

    const creada = await s.pedir('POST', '/cliente/direcciones', { token: a.token, cuerpo: { direccion: '4a calle 1-23 zona 10', ciudad: 'Guatemala', telefono: '22223333' } });
    assert.equal(creada.estado, 201);
    const idA = creada.datos.IDDireccion as number;

    assert.equal((await s.pedir('GET', '/cliente/direcciones', { token: a.token })).datos.length, 1);
    assert.equal((await s.pedir('GET', '/cliente/direcciones', { token: b.token })).datos.length, 0);

    const otra = { direccion: 'Cambiada por B', ciudad: 'Mixco', telefono: '1' };
    assert.equal((await s.pedir('PUT', `/cliente/direcciones/${idA}`, { token: b.token, cuerpo: otra })).estado, 404);
    assert.equal((await s.pedir('DELETE', `/cliente/direcciones/${idA}`, { token: b.token })).estado, 404);

    // B no puede pagar con la dirección de A.
    await s.pedir('POST', '/publico/carrito/items', { token: b.token, cuerpo: { idVariante: await idVariante('COM-USB-128'), cantidad: 1 } });
    const ajena = await s.pedir('POST', '/cliente/checkout/pagos', { token: b.token, cuerpo: { idDireccion: idA } });
    assert.equal(ajena.estado, 404);

    // La dirección de A sigue intacta.
    const deA = await s.pedir('GET', '/cliente/direcciones', { token: a.token });
    assert.equal(deA.datos[0].Direccion, '4a calle 1-23 zona 10');
    assert.equal((await s.pedir('GET', '/cliente/direcciones')).estado, 401);
  });

  test('checkout con IDDireccion copia el texto en la reserva y el pedido', async () => {
    const a = await s.registrar('dir-c');
    const creada = await s.pedir('POST', '/cliente/direcciones', { token: a.token, cuerpo: { direccion: 'Km 15 carretera a El Salvador', ciudad: 'Santa Catarina Pinula', telefono: '44445555' } });
    const idDir = creada.datos.IDDireccion as number;

    await s.pedir('POST', '/publico/carrito/items', { token: a.token, cuerpo: { idVariante: await idVariante('COM-USB-128'), cantidad: 1 } });
    assert.equal((await s.pedir('POST', '/cliente/checkout/pagos', { token: a.token, cuerpo: {} })).estado, 400);
    const reserva = await s.pedir('POST', '/cliente/checkout/pagos', { token: a.token, cuerpo: { idDireccion: idDir } });
    assert.equal(reserva.estado, 201);
    assert.equal(reserva.datos.IDDireccion, idDir);
    assert.equal(reserva.datos.Direccion, 'Km 15 carretera a El Salvador');
    const pedido = await s.pedir('POST', `/cliente/checkout/reservas/${reserva.datos.IDReserva}/pedido`, { token: a.token });
    assert.equal(pedido.estado, 201);

    // Cambiar la dirección después no altera el pedido: el texto quedó copiado.
    const cambio = await s.pedir('PUT', `/cliente/direcciones/${idDir}`, { token: a.token, cuerpo: { direccion: 'Otra dirección', ciudad: 'Antigua Guatemala', telefono: '7777' } });
    assert.equal(cambio.estado, 200);
    const despues = await s.pedir('GET', `/cliente/pedidos/${pedido.datos.IDPedido}`, { token: a.token });
    assert.equal(despues.datos.Direccion, 'Km 15 carretera a El Salvador');
    assert.equal(despues.datos.Ciudad, 'Santa Catarina Pinula');

    // Una dirección desactivada ya no se puede usar ni modificar.
    assert.equal((await s.pedir('DELETE', `/cliente/direcciones/${idDir}`, { token: a.token })).datos.Activa, false);
    await s.pedir('POST', '/publico/carrito/items', { token: a.token, cuerpo: { idVariante: await idVariante('COM-USB-128'), cantidad: 1 } });
    assert.equal((await s.pedir('POST', '/cliente/checkout/pagos', { token: a.token, cuerpo: { idDireccion: idDir } })).estado, 404);
    assert.equal((await s.pedir('GET', '/cliente/direcciones', { token: a.token })).datos.length, 0);
  });

  test('checkout con el texto registra la dirección y la reutiliza si es idéntica', async () => {
    const a = await s.registrar('dir-d');
    await s.pedir('POST', '/publico/carrito/items', { token: a.token, cuerpo: { idVariante: await idVariante('COM-USB-128'), cantidad: 1 } });
    const r1 = await s.pedir('POST', '/cliente/checkout/pagos', { token: a.token, cuerpo: direccion });
    assert.equal(r1.estado, 201);
    const lista = await s.pedir('GET', '/cliente/direcciones', { token: a.token });
    assert.equal(lista.datos.length, 1);
    assert.equal(lista.datos[0].IDDireccion, r1.datos.IDDireccion);

    await s.pedir('DELETE', `/cliente/checkout/reservas/${r1.datos.IDReserva}`, { token: a.token });
    const r2 = await s.pedir('POST', '/cliente/checkout/pagos', { token: a.token, cuerpo: direccion });
    assert.equal(r2.datos.IDDireccion, r1.datos.IDDireccion);
    assert.equal((await s.pedir('GET', '/cliente/direcciones', { token: a.token })).datos.length, 1);
  });
});
