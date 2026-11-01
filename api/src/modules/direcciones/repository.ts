import { ejecutar, filas, primera, sql } from '../../compartido/db.js';

export interface DatosDireccion {
  direccion: string;
  ciudad: string;
  telefono: string;
}

const texto = (d: DatosDireccion) => ({
  Direccion: [sql.NVarChar(300), d.direccion] as [unknown, unknown],
  Ciudad: [sql.NVarChar(100), d.ciudad] as [unknown, unknown],
  Telefono: [sql.NVarChar(20), d.telefono] as [unknown, unknown],
});

export async function listar(idUsuario: number) {
  return filas(await ejecutar('SP_Direcciones_Listar', { IDUsuario: [sql.Int, idUsuario] }));
}

export async function crear(idUsuario: number, d: DatosDireccion) {
  return primera(await ejecutar('SP_Direcciones_Crear', { IDUsuario: [sql.Int, idUsuario], ...texto(d) }));
}

export async function actualizar(idUsuario: number, idDireccion: number, d: DatosDireccion) {
  return primera(
    await ejecutar('SP_Direcciones_Actualizar', { IDUsuario: [sql.Int, idUsuario], IDDireccion: [sql.Int, idDireccion], ...texto(d) }),
  );
}

export async function desactivar(idUsuario: number, idDireccion: number) {
  return primera(await ejecutar('SP_Direcciones_Desactivar', { IDUsuario: [sql.Int, idUsuario], IDDireccion: [sql.Int, idDireccion] }));
}
