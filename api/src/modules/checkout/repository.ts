import { ejecutar, filas, primera, sql, type Resultado } from '../../compartido/db.js';

function reserva(r: Resultado) {
  return { ...primera<object>(r)!, lineas: filas(r, 1) };
}

// La dirección se elige por IDDireccion o se registra con su texto.
export interface DatosEntrega {
  idDireccion?: number | undefined;
  direccion?: string | undefined;
  ciudad?: string | undefined;
  telefono?: string | undefined;
}

export async function iniciarPago(idUsuario: number, e: DatosEntrega, codigo: string | null) {
  return reserva(
    await ejecutar('SP_Checkout_IniciarPago', {
      IDUsuario: [sql.Int, idUsuario],
      IDDireccion: [sql.Int, e.idDireccion ?? null],
      Direccion: [sql.NVarChar(300), e.direccion ?? null],
      Ciudad: [sql.NVarChar(100), e.ciudad ?? null],
      Telefono: [sql.NVarChar(20), e.telefono ?? null],
      Codigo: [sql.NVarChar(30), codigo],
    }),
  );
}

export async function obtenerReserva(idUsuario: number, idReserva: number) {
  return reserva(await ejecutar('SP_Checkout_ObtenerReserva', { IDUsuario: [sql.Int, idUsuario], IDReserva: [sql.Int, idReserva] }));
}

export async function cancelarPago(idUsuario: number, idReserva: number) {
  return reserva(await ejecutar('SP_Checkout_CancelarPago', { IDUsuario: [sql.Int, idUsuario], IDReserva: [sql.Int, idReserva] }));
}

export async function crearPedido(idUsuario: number, idReserva: number) {
  const r = await ejecutar('SP_Pedidos_CrearPedido', { IDUsuario: [sql.Int, idUsuario], IDReserva: [sql.Int, idReserva] });
  return { ...primera<object>(r)!, lineas: filas(r, 1), historial: filas(r, 2) };
}
