import { ejecutar, filas, pagina, primera, sql } from '../../compartido/db.js';

export interface Rango {
  desde?: string;
  hasta?: string;
}

const rango = (r: Rango) => ({
  Desde: [sql.Date, r.desde ?? null] as [unknown, unknown],
  Hasta: [sql.Date, r.hasta ?? null] as [unknown, unknown],
});

export async function ventasPorPeriodo(idUsuario: number, agrupacion: string, r: Rango) {
  return filas(
    await ejecutar('SP_Dashboard_VentasPorPeriodo', {
      IDUsuario: [sql.Int, idUsuario],
      Agrupacion: [sql.NVarChar(10), agrupacion],
      ...rango(r),
    }),
  );
}

export async function ventasPorCategoria(idUsuario: number, r: Rango) {
  return filas(await ejecutar('SP_Dashboard_VentasPorCategoria', { IDUsuario: [sql.Int, idUsuario], ...rango(r) }));
}

export async function topProductos(idUsuario: number, r: Rango, cantidad: number) {
  return filas(await ejecutar('SP_Dashboard_TopProductos', { IDUsuario: [sql.Int, idUsuario], ...rango(r), Cantidad: [sql.Int, cantidad] }));
}

export async function indicadores(idUsuario: number, r: Rango, horas: number) {
  const res = await ejecutar('SP_Dashboard_Indicadores', { IDUsuario: [sql.Int, idUsuario], ...rango(r), Horas: [sql.Int, horas] });
  return primera(res);
}

export async function carritosAbandonados(idUsuario: number, horas: number, numero: number, tamano: number) {
  const r = await ejecutar('SP_Dashboard_CarritosAbandonados', {
    IDUsuario: [sql.Int, idUsuario],
    Horas: [sql.Int, horas],
    Pagina: [sql.Int, numero],
    Tamano: [sql.Int, tamano],
  });
  return pagina(r, numero, tamano);
}

export async function bitacora(idUsuario: number, modulo: string | null, r: Rango, orden: string, numero: number, tamano: number) {
  const res = await ejecutar('SP_Bitacora_Listar', {
    IDUsuario: [sql.Int, idUsuario],
    Modulo: [sql.NVarChar(20), modulo],
    ...rango(r),
    Orden: [sql.NVarChar(20), orden],
    Pagina: [sql.Int, numero],
    Tamano: [sql.Int, tamano],
  });
  return pagina(res, numero, tamano);
}
