import { ejecutar, filas, sql, type Resultado } from '../../compartido/db.js';

export interface DatosRol {
  nombre: string;
  descripcion: string | null;
  permisos: string[];
}

// El SP devuelve los roles y, aparte, los pares rol-permiso.
function roles(r: Resultado) {
  const permisos = filas<{ IDRol: number; Codigo: string }>(r, 1);
  return filas<{ IDRol: number }>(r).map((rol) => ({
    ...rol,
    permisos: permisos.filter((p) => p.IDRol === rol.IDRol).map((p) => p.Codigo),
  }));
}

export async function listarPermisos(idUsuario: number) {
  return filas(await ejecutar('SP_Roles_ListarPermisos', { IDUsuario: [sql.Int, idUsuario] }));
}

export async function listar(idUsuario: number) {
  return roles(await ejecutar('SP_Roles_Listar', { IDUsuario: [sql.Int, idUsuario] }));
}

export async function obtener(idUsuario: number, idRol: number) {
  return roles(await ejecutar('SP_Roles_Listar', { IDUsuario: [sql.Int, idUsuario], IDRol: [sql.Int, idRol] }))[0];
}

export async function crear(idUsuario: number, d: DatosRol) {
  const r = await ejecutar('SP_Roles_Crear', {
    IDUsuario: [sql.Int, idUsuario],
    Nombre: [sql.NVarChar(20), d.nombre],
    Descripcion: [sql.NVarChar(200), d.descripcion],
    Permisos: [sql.NVarChar(sql.MAX), JSON.stringify(d.permisos)],
  });
  return roles(r)[0];
}

export async function actualizar(idUsuario: number, idRol: number, d: DatosRol, activo: boolean) {
  const r = await ejecutar('SP_Roles_Actualizar', {
    IDUsuario: [sql.Int, idUsuario],
    IDRol: [sql.Int, idRol],
    Nombre: [sql.NVarChar(20), d.nombre],
    Descripcion: [sql.NVarChar(200), d.descripcion],
    Activo: [sql.Bit, activo],
    Permisos: [sql.NVarChar(sql.MAX), JSON.stringify(d.permisos)],
  });
  return roles(r)[0];
}
