import { ejecutar, pagina, primera, sql } from '../../db.js';

export async function registrar(idUsuario: number, idVariante: number, tipo: string, cantidad: number, motivo: string) {
  const r = await ejecutar('SP_Inventario_Registrar', {
    IDUsuario: [sql.Int, idUsuario],
    IDVariante: [sql.Int, idVariante],
    Tipo: [sql.NVarChar(12), tipo],
    Cantidad: [sql.Int, cantidad],
    Motivo: [sql.NVarChar(300), motivo],
  });
  return primera(r);
}

export async function kardex(idVariante: number, numero: number, tamano: number) {
  const r = await ejecutar('SP_Inventario_ConsultarKardex', {
    IDVariante: [sql.Int, idVariante],
    Pagina: [sql.Int, numero],
    Tamano: [sql.Int, tamano],
  });
  return pagina(r, numero, tamano);
}

export async function existencias(umbral: number | null, numero: number, tamano: number) {
  const r = await ejecutar('SP_Inventario_ListarExistencias', {
    Umbral: [sql.Int, umbral],
    Pagina: [sql.Int, numero],
    Tamano: [sql.Int, tamano],
  });
  return pagina(r, numero, tamano);
}
