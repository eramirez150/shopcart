import { AppError, traducir } from '../../compartido/errors.js';
import * as repo from './repository.js';

export const { listar } = repo;

// La regla vive en el SP. Aquí sus errores reciben un código propio para que el cliente
// los distinga: 403 es que no compró el producto y 409 que ya lo reseñó.
export async function crear(idUsuario: number, idProducto: number, calificacion: number, comentario: string) {
  try {
    return await repo.crear(idUsuario, idProducto, calificacion, comentario);
  } catch (e) {
    const error = traducir(e);
    if (error.estado === 403) throw new AppError(403, error.message, 'RESENA_SIN_COMPRA');
    if (error.estado === 409) throw new AppError(409, error.message, 'RESENA_DUPLICADA');
    throw error;
  }
}

export async function obtenerPermiso(idUsuario: number, idProducto: number) {
  const { Motivo } = await repo.obtenerPermiso(idUsuario, idProducto);
  return { puede: Motivo === null, motivo: Motivo };
}
