import { AppError } from '../../compartido/errors.js';
import * as repo from './repository.js';

export type TipoMovimiento = 'Entrada' | 'Salida' | 'Ajuste';

// Entrada y Salida llevan cantidad positiva; solo el ajuste admite signo.
export function registrarMovimiento(idUsuario: number, idVariante: number, tipo: TipoMovimiento, cantidad: number, motivo: string) {
  if (cantidad === 0) throw new AppError(400, 'La cantidad no puede ser cero', 'VALIDACION');
  if (tipo !== 'Ajuste' && cantidad < 0) throw new AppError(400, 'La cantidad debe ser positiva', 'VALIDACION');
  return repo.registrar(idUsuario, idVariante, tipo, cantidad, motivo);
}

export const { kardex, existencias } = repo;
