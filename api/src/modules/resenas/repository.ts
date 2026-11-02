import { ejecutar, filas, primera, sql } from '../../compartido/db.js';

export interface Resena {
  IDResena: number;
  Autor: string;
  Calificacion: number;
  Comentario: string;
  Fecha: Date;
}

export async function listar(idProducto: number, incluirInactivos: boolean, pagina: number, tamano: number) {
  const r = await ejecutar('SP_Resenas_Listar', {
    IDProducto: [sql.Int, idProducto],
    IncluirInactivos: [sql.Bit, incluirInactivos],
    Pagina: [sql.Int, pagina],
    Tamano: [sql.Int, tamano],
  });
  const resumen = primera<{ Total: number; Promedio: number | null }>(r)!;
  return { total: resumen.Total, promedio: resumen.Promedio, pagina, tamano, datos: filas<Resena>(r, 1) };
}

export async function crear(idUsuario: number, idProducto: number, calificacion: number, comentario: string) {
  const r = await ejecutar('SP_Resenas_Crear', {
    IDUsuario: [sql.Int, idUsuario],
    IDProducto: [sql.Int, idProducto],
    Calificacion: [sql.Int, calificacion],
    Comentario: [sql.NVarChar(1000), comentario],
  });
  return primera<Resena>(r)!;
}

export async function obtenerPermiso(idUsuario: number, idProducto: number) {
  const r = await ejecutar('SP_Resenas_ObtenerPermiso', { IDUsuario: [sql.Int, idUsuario], IDProducto: [sql.Int, idProducto] });
  return primera<{ Motivo: string | null }>(r)!;
}
