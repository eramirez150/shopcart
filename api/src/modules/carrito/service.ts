import { AppError } from '../../errors.js';
import type { UsuarioToken } from '../../middleware/auth.js';
import * as repo from './repository.js';

// Con sesión, el carrito es del usuario del JWT; sin sesión, del token de invitado.
// Un invitado nuevo no envía token: el primer agregado crea el carrito y devuelve el suyo.
export function duenoDe(usuario: UsuarioToken | undefined, token: string | null): repo.Dueno {
  return usuario ? { idUsuario: usuario.id, token: null } : { idUsuario: null, token };
}

export const { agregar, modificar, eliminar } = repo;

// Un invitado sin token todavía no tiene carrito: se responde vacío sin crear uno.
export function obtener(d: repo.Dueno) {
  if (d.idUsuario === null && d.token === null) {
    return { IDCarrito: null, TokenInvitado: null, Cupon: null, Subtotal: 0, Descuento: 0, Total: 0, lineas: [] };
  }
  return repo.obtener(d);
}

export function aplicarCupon(usuario: UsuarioToken | undefined, codigo: string) {
  if (!usuario) throw new AppError(401, 'Inicie sesión para aplicar un cupón', 'NO_AUTENTICADO');
  return repo.aplicarCupon(usuario.id, codigo);
}

export function quitarCupon(usuario: UsuarioToken | undefined) {
  if (!usuario) throw new AppError(401, 'Inicie sesión para quitar un cupón', 'NO_AUTENTICADO');
  return repo.quitarCupon(usuario.id);
}
