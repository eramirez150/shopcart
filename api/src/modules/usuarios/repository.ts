import { ejecutar, pagina, primera, sql } from '../../compartido/db.js';

export async function crear(idUsuario: number, correo: string, claveHash: string, nombre: string, rol: string) {
  const r = await ejecutar('SP_Usuarios_Crear', {
    IDUsuario: [sql.Int, idUsuario],
    Correo: [sql.NVarChar(150), correo],
    ClaveHash: [sql.NVarChar(100), claveHash],
    Nombre: [sql.NVarChar(100), nombre],
    Rol: [sql.NVarChar(20), rol],
  });
  return primera(r);
}

export async function listar(idUsuario: number, rol: string | null, numero: number, tamano: number) {
  const r = await ejecutar('SP_Usuarios_Listar', {
    IDUsuario: [sql.Int, idUsuario],
    Rol: [sql.NVarChar(20), rol],
    Pagina: [sql.Int, numero],
    Tamano: [sql.Int, tamano],
  });
  return pagina(r, numero, tamano);
}

export async function actualizar(idUsuario: number, idObjetivo: number, rol: string | null, activo: boolean | null) {
  const r = await ejecutar('SP_Usuarios_Actualizar', {
    IDUsuario: [sql.Int, idUsuario],
    IDObjetivo: [sql.Int, idObjetivo],
    Rol: [sql.NVarChar(20), rol],
    Activo: [sql.Bit, activo],
  });
  return primera(r);
}
