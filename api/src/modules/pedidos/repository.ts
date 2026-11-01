import { ejecutar, filas, pagina, primera, sql, type Resultado } from '../../compartido/db.js';

export interface FiltrosPedidos {
  estado?: string;
  desde?: string;
  hasta?: string;
  idCliente?: number;
  totalMin?: number;
  totalMax?: number;
  pagina: number;
  tamano: number;
}

function pedido(r: Resultado) {
  return { ...primera<{ Estado: string }>(r)!, lineas: filas(r, 1), historial: filas(r, 2) };
}

function devoluciones(r: Resultado) {
  const lineas = filas<{ IDDevolucion: number }>(r, 1);
  return filas<{ IDDevolucion: number }>(r).map((d) => ({ ...d, lineas: lineas.filter((l) => l.IDDevolucion === d.IDDevolucion) }));
}

export async function listar(idUsuario: number, f: FiltrosPedidos) {
  const r = await ejecutar('SP_Pedidos_Listar', {
    IDUsuario: [sql.Int, idUsuario],
    Estado: [sql.NVarChar(20), f.estado ?? null],
    Desde: [sql.Date, f.desde ?? null],
    Hasta: [sql.Date, f.hasta ?? null],
    IDCliente: [sql.Int, f.idCliente ?? null],
    TotalMin: [sql.Decimal(12, 2), f.totalMin ?? null],
    TotalMax: [sql.Decimal(12, 2), f.totalMax ?? null],
    Pagina: [sql.Int, f.pagina],
    Tamano: [sql.Int, f.tamano],
  });
  return pagina(r, f.pagina, f.tamano);
}

export async function obtener(idUsuario: number, idPedido: number) {
  return pedido(await ejecutar('SP_Pedidos_Obtener', { IDUsuario: [sql.Int, idUsuario], IDPedido: [sql.Int, idPedido] }));
}

export async function cambiarEstado(idUsuario: number, idPedido: number, estado: string, comentario: string | null) {
  return pedido(
    await ejecutar('SP_Pedidos_CambiarEstado', {
      IDUsuario: [sql.Int, idUsuario],
      IDPedido: [sql.Int, idPedido],
      EstadoNuevo: [sql.NVarChar(20), estado],
      Comentario: [sql.NVarChar(300), comentario],
    }),
  );
}

export async function registrarDevolucion(idUsuario: number, idPedido: number, motivo: string, lineas: object[]) {
  return devoluciones(
    await ejecutar('SP_Devoluciones_Registrar', {
      IDUsuario: [sql.Int, idUsuario],
      IDPedido: [sql.Int, idPedido],
      Motivo: [sql.NVarChar(300), motivo],
      Lineas: [sql.NVarChar(sql.MAX), JSON.stringify(lineas)],
    }),
  );
}

export async function listarDevoluciones(idUsuario: number, idPedido: number) {
  return devoluciones(await ejecutar('SP_Devoluciones_ListarPorPedido', { IDUsuario: [sql.Int, idUsuario], IDPedido: [sql.Int, idPedido] }));
}
