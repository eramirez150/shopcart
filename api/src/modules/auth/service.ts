import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../compartido/config.js';
import { AppError } from '../../compartido/errors.js';
import type { Audiencia, UsuarioToken } from '../../middleware/auth.js';
import * as repo from './repository.js';

const COSTO_BCRYPT = 10;
// Hash de relleno para que el tiempo de respuesta no revele si el correo existe.
const HASH_RELLENO = bcrypt.hashSync('relleno-sin-uso', COSTO_BCRYPT);

const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex');

// El Cliente entra por la tienda; cualquier otro rol, por administración.
const audienciaDe = (rol: string): Audiencia => (rol === 'Cliente' ? 'tienda' : 'admin');

function firmarAcceso(u: UsuarioToken, audiencia: Audiencia): string {
  return jwt.sign({ rol: u.rol }, config.jwt.secreto, {
    algorithm: 'HS256',
    subject: String(u.id),
    audience: audiencia,
    expiresIn: config.jwt.accesoMinutos * 60,
  });
}

function respuesta(u: repo.UsuarioFila, refreshToken: string, audiencia: Audiencia) {
  return {
    accessToken: firmarAcceso({ id: u.IDUsuario, rol: u.Rol }, audiencia),
    refreshToken,
    expiresIn: config.jwt.accesoMinutos * 60,
    usuario: { id: u.IDUsuario, correo: u.Correo, nombre: u.Nombre, rol: u.Rol },
  };
}

const nuevoRefresh = () => ({
  token: randomBytes(48).toString('base64url'),
  expira: new Date(Date.now() + config.jwt.refreshDias * 86_400_000),
});

async function emitirSesion(u: repo.UsuarioFila, audiencia: Audiencia) {
  const r = nuevoRefresh();
  await repo.guardarRefresh(u.IDUsuario, sha256(r.token), r.expira, audiencia);
  return respuesta(u, r.token, audiencia);
}

export async function registrar(correo: string, clave: string, nombre: string) {
  const hash = await bcrypt.hash(clave, COSTO_BCRYPT);
  return emitirSesion(await repo.registrar(correo, hash, nombre), 'tienda');
}

export async function iniciarSesion(correo: string, clave: string, audiencia: Audiencia, tokenInvitado: string | null = null) {
  const u = await repo.obtenerPorCorreo(correo);
  const valida = await bcrypt.compare(clave, u?.ClaveHash ?? HASH_RELLENO);
  // Entrar por el servicio equivocado responde igual que una clave mala: no revela la cuenta.
  if (!u || !valida || !u.Activo || audienciaDe(u.Rol) !== audiencia) {
    throw new AppError(401, 'Correo o contraseña incorrectos', 'CREDENCIALES');
  }
  // El carrito de invitado pasa a la cuenta al iniciar sesión.
  if (tokenInvitado) await repo.fusionarCarrito(u.IDUsuario, tokenInvitado);
  return emitirSesion(u, audiencia);
}

export const { tienePermiso } = repo;

// Rotación: cada refresh token sirve una sola vez.
export async function renovar(refreshToken: string, audiencia: Audiencia) {
  const r = nuevoRefresh();
  const u = await repo.rotarRefresh(sha256(refreshToken), sha256(r.token), r.expira, audiencia);
  return respuesta(u, r.token, audiencia);
}

export async function cerrarSesion(refreshToken: string, audiencia: Audiencia) {
  await repo.revocarRefresh(sha256(refreshToken), audiencia);
}
