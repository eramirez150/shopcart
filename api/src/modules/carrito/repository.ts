import { ejecutar, filas, primera, sql, type Resultado } from '../../db.js';

// Identifica al dueño del carrito: usuario autenticado (del JWT) o token de invitado.
export interface Dueno {
  idUsuario: number | null;
  token: string | null;
}

const dueno = (d: Dueno) => ({
  IDUsuario: [sql.Int, d.idUsuario] as [unknown, unknown],
  TokenInvitado: [sql.UniqueIdentifier, d.token] as [unknown, unknown],
});

function carrito(r: Resultado) {
  return {
    ...primera<object>(r)!,
    lineas: filas<{ Atributos: string }>(r, 1).map((l) => ({ ...l, Atributos: JSON.parse(l.Atributos) as unknown })),
  };
}

export async function obtener(d: Dueno) {
  return carrito(await ejecutar('SP_Carrito_Obtener', dueno(d)));
}

export async function agregar(d: Dueno, idVariante: number, cantidad: number) {
  return carrito(await ejecutar('SP_Carrito_Agregar', { ...dueno(d), IDVariante: [sql.Int, idVariante], Cantidad: [sql.Int, cantidad] }));
}

export async function modificar(d: Dueno, idVariante: number, cantidad: number) {
  return carrito(await ejecutar('SP_Carrito_Modificar', { ...dueno(d), IDVariante: [sql.Int, idVariante], Cantidad: [sql.Int, cantidad] }));
}

export async function eliminar(d: Dueno, idVariante: number) {
  return carrito(await ejecutar('SP_Carrito_Eliminar', { ...dueno(d), IDVariante: [sql.Int, idVariante] }));
}

export async function aplicarCupon(idUsuario: number, codigo: string) {
  return carrito(
    await ejecutar('SP_Carrito_AplicarCupon', {
      IDUsuario: [sql.Int, idUsuario],
      TokenInvitado: [sql.UniqueIdentifier, null],
      Codigo: [sql.NVarChar(30), codigo],
    }),
  );
}

export async function quitarCupon(idUsuario: number) {
  return carrito(await ejecutar('SP_Carrito_QuitarCupon', { IDUsuario: [sql.Int, idUsuario] }));
}
