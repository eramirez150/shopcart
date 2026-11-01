import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../../compartido/config.js';
import { AppError } from '../../compartido/errors.js';
import { firmarAcceso } from '../../middleware/auth.js';
import * as repo from './repository.js';

const COSTO_BCRYPT = 10;
// Hash de relleno para que el tiempo de respuesta no revele si el correo existe.
const HASH_RELLENO = bcrypt.hashSync('relleno-sin-uso', COSTO_BCRYPT);

const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex');

function respuesta(u: repo.UsuarioFila, refreshToken: string) {
  return {
    accessToken: firmarAcceso({ id: u.IDUsuario, rol: u.Rol }),
    refreshToken,
    expiresIn: config.jwt.accesoMinutos * 60,
    usuario: { id: u.IDUsuario, correo: u.Correo, nombre: u.Nombre, rol: u.Rol },
  };
}

const nuevoRefresh = () => ({
  token: randomBytes(48).toString('base64url'),
  expira: new Date(Date.now() + config.jwt.refreshDias * 86_400_000),
});

async function emitirSesion(u: repo.UsuarioFila) {
  const r = nuevoRefresh();
  await repo.guardarRefresh(u.IDUsuario, sha256(r.token), r.expira);
  return respuesta(u, r.token);
}

export async function registrar(correo: string, clave: string, nombre: string) {
  const hash = await bcrypt.hash(clave, COSTO_BCRYPT);
  return emitirSesion(await repo.registrar(correo, hash, nombre));
}

export async function iniciarSesion(correo: string, clave: string, tokenInvitado: string | null) {
  const u = await repo.obtenerPorCorreo(correo);
  const valida = await bcrypt.compare(clave, u?.ClaveHash ?? HASH_RELLENO);
  if (!u || !valida || !u.Activo) throw new AppError(401, 'Correo o contraseña incorrectos', 'CREDENCIALES');
  // El carrito de invitado pasa a la cuenta al iniciar sesión.
  if (tokenInvitado) await repo.fusionarCarrito(u.IDUsuario, tokenInvitado);
  return emitirSesion(u);
}

// Rotación: cada refresh token sirve una sola vez.
export async function renovar(refreshToken: string) {
  const r = nuevoRefresh();
  const u = await repo.rotarRefresh(sha256(refreshToken), sha256(r.token), r.expira);
  return respuesta(u, r.token);
}

export async function cerrarSesion(refreshToken: string) {
  await repo.revocarRefresh(sha256(refreshToken));
}
