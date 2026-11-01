import { ejecutar, pagina, primera, sql } from '../../compartido/db.js';

export interface CuponEntrada {
  tipo: string;
  valor: number;
  fechaInicio: Date;
  fechaFin: Date;
  minimoCompra: number;
  limiteTotal: number | null;
  limitePorCliente: number | null;
  idCategoria: number | null;
}

const comunes = (c: CuponEntrada) => ({
  Tipo: [sql.NVarChar(10), c.tipo] as [unknown, unknown],
  Valor: [sql.Decimal(12, 2), c.valor] as [unknown, unknown],
  FechaInicio: [sql.DateTime2(0), c.fechaInicio] as [unknown, unknown],
  FechaFin: [sql.DateTime2(0), c.fechaFin] as [unknown, unknown],
  MinimoCompra: [sql.Decimal(12, 2), c.minimoCompra] as [unknown, unknown],
  LimiteTotal: [sql.Int, c.limiteTotal] as [unknown, unknown],
  LimitePorCliente: [sql.Int, c.limitePorCliente] as [unknown, unknown],
  IDCategoria: [sql.Int, c.idCategoria] as [unknown, unknown],
});

export async function listar(idUsuario: number, numero: number, tamano: number) {
  const r = await ejecutar('SP_Cupones_Listar', {
    IDUsuario: [sql.Int, idUsuario],
    Pagina: [sql.Int, numero],
    Tamano: [sql.Int, tamano],
  });
  return pagina(r, numero, tamano);
}

export async function crear(idUsuario: number, codigo: string, c: CuponEntrada) {
  const r = await ejecutar('SP_Cupones_Crear', {
    IDUsuario: [sql.Int, idUsuario],
    Codigo: [sql.NVarChar(30), codigo],
    ...comunes(c),
  });
  return primera(r);
}

export async function actualizar(idUsuario: number, id: number, c: CuponEntrada, activo: boolean) {
  const r = await ejecutar('SP_Cupones_Actualizar', {
    IDUsuario: [sql.Int, idUsuario],
    IDCupon: [sql.Int, id],
    ...comunes(c),
    Activo: [sql.Bit, activo],
  });
  return primera(r);
}
