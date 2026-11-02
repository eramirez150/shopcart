import { ejecutar, primera, sql } from '../../compartido/db.js';
import type { Audiencia, Rol } from '../../middleware/auth.js';

export interface UsuarioFila {
  IDUsuario: number;
  Correo: string;
  Nombre: string;
  Rol: Rol;
  Activo?: boolean;
}

export async function registrar(correo: string, claveHash: string, nombre: string) {
  const r = await ejecutar('SP_Auth_Registrar', {
    Correo: [sql.NVarChar(150), correo],
    ClaveHash: [sql.NVarChar(100), claveHash],
    Nombre: [sql.NVarChar(100), nombre],
  });
  return primera<UsuarioFila>(r)!;
}

export async function obtenerPorCorreo(correo: string) {
  const r = await ejecutar('SP_Auth_ObtenerPorCorreo', { Correo: [sql.NVarChar(150), correo] });
  return primera<UsuarioFila & { ClaveHash: string }>(r);
}

export async function guardarRefresh(idUsuario: number, tokenHash: string, expira: Date, audiencia: Audiencia) {
  await ejecutar('SP_Auth_GuardarRefresh', {
    IDUsuario: [sql.Int, idUsuario],
    TokenHash: [sql.Char(64), tokenHash],
    Expira: [sql.DateTime2(0), expira],
    Audiencia: [sql.NVarChar(10), audiencia],
  });
}

export async function rotarRefresh(tokenHash: string, nuevoHash: string, nuevaExpira: Date, audiencia: Audiencia) {
  const r = await ejecutar('SP_Auth_RotarRefresh', {
    TokenHash: [sql.Char(64), tokenHash],
    NuevoTokenHash: [sql.Char(64), nuevoHash],
    NuevaExpira: [sql.DateTime2(0), nuevaExpira],
    Audiencia: [sql.NVarChar(10), audiencia],
  });
  return primera<UsuarioFila>(r)!;
}

export async function revocarRefresh(tokenHash: string, audiencia: Audiencia) {
  await ejecutar('SP_Auth_RevocarRefresh', { TokenHash: [sql.Char(64), tokenHash], Audiencia: [sql.NVarChar(10), audiencia] });
}

export async function fusionarCarrito(idUsuario: number, token: string) {
  await ejecutar('SP_Carrito_Fusionar', {
    IDUsuario: [sql.Int, idUsuario],
    TokenInvitado: [sql.UniqueIdentifier, token],
  });
}
