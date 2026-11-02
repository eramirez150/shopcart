import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../compartido/config.js';
import { AppError } from '../compartido/errors.js';
import { tienePermiso } from '../modules/auth/service.js';

// Cada servicio firma y acepta solo los tokens de su audiencia.
export type Audiencia = 'tienda' | 'admin';
// Mismos códigos que dbo.Permisos. Tener modulo.gestionar incluye modulo.ver.
export type Permiso =
  | 'pedidos.ver'
  | 'pedidos.gestionar'
  | 'inventario.ver'
  | 'inventario.gestionar'
  | 'catalogo.gestionar'
  | 'cupones.gestionar'
  | 'usuarios.gestionar'
  | 'reportes.ver'
  | 'bitacora.ver'
  | 'roles.gestionar';

export interface UsuarioToken {
  id: number;
  rol: string;
}

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioToken;
    }
  }
}

function leerToken(req: Request, audiencia: Audiencia): UsuarioToken | undefined {
  const cabecera = req.header('authorization');
  if (!cabecera) return undefined;
  const [esquema, token] = cabecera.split(' ');
  if (esquema !== 'Bearer' || !token) throw new AppError(401, 'Cabecera Authorization inválida', 'NO_AUTENTICADO');
  try {
    const p = jwt.verify(token, config.jwt.secreto, { algorithms: ['HS256'], audience: audiencia });
    if (typeof p === 'string' || !p.sub) throw new Error('payload');
    return { id: Number(p.sub), rol: p['rol'] as string };
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) throw new AppError(401, 'El token expiró', 'TOKEN_EXPIRADO');
    throw new AppError(401, 'Token inválido', 'TOKEN_INVALIDO');
  }
}

// El usuario sale siempre del JWT: ningún SP recibe un IDUsuario del body ni de la URL.
export function autenticar(audiencia: Audiencia) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const u = leerToken(req, audiencia);
    if (!u) throw new AppError(401, 'Falta el token de acceso', 'NO_AUTENTICADO');
    req.usuario = u;
    next();
  };
}

// Para rutas públicas que cambian si hay sesión (carrito de invitado).
export function autenticarOpcional(audiencia: Audiencia) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.usuario = leerToken(req, audiencia);
    next();
  };
}

// Consulta la base en cada petición: quitar un permiso tiene efecto inmediato.
export function autorizar(permiso: Permiso) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.usuario) throw new AppError(401, 'Falta el token de acceso', 'NO_AUTENTICADO');
    if (!(await tienePermiso(req.usuario.id, permiso))) throw new AppError(403, 'No tiene permiso para este recurso', 'PROHIBIDO');
    next();
  };
}

export function idUsuario(req: Request): number {
  if (!req.usuario) throw new AppError(401, 'Falta el token de acceso', 'NO_AUTENTICADO');
  return req.usuario.id;
}

const guid = z.guid();
// Token del carrito de invitado, enviado en la cabecera X-Carrito-Token.
export function tokenInvitado(req: Request): string | null {
  const t = req.header('x-carrito-token');
  if (!t) return null;
  const r = guid.safeParse(t);
  if (!r.success) throw new AppError(400, 'X-Carrito-Token inválido', 'VALIDACION');
  return r.data;
}
