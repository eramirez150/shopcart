import { AppError } from '../../errors.js';
import * as repo from './repository.js';

// Las fechas son opcionales; si vienen las dos, el rango debe tener sentido.
export function validarRango(r: repo.Rango): repo.Rango {
  if (r.desde && r.hasta && r.desde > r.hasta) throw new AppError(400, 'desde no puede ser posterior a hasta', 'VALIDACION');
  return r;
}

export const { ventasPorPeriodo, ventasPorCategoria, topProductos, indicadores, carritosAbandonados, bitacora } = repo;
