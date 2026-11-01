import { AppError } from '../../errors.js';
import type { UsuarioToken } from '../../middleware/auth.js';
import * as repo from './repository.js';

export type EstadoPedido = 'Pagado' | 'EnPreparacion' | 'Despachado' | 'Entregado' | 'DevueltoParcial' | 'Devuelto' | 'Cancelado';

// Mismas transiciones que dbo.PedidoTransiciones. Se valida aquí para responder rápido
// y otra vez en SP_Pedidos_CambiarEstado, que es la barrera definitiva.
// Los estados de devolución no aparecen: se alcanzan solo registrando una devolución.
const TRANSICIONES: Record<string, EstadoPedido[]> = {
  Pagado: ['EnPreparacion', 'Cancelado'],
  EnPreparacion: ['Despachado', 'Cancelado'],
  Despachado: ['Entregado'],
};

export async function cambiarEstado(usuario: UsuarioToken, idPedido: number, estado: EstadoPedido, comentario: string | null) {
  const actual = await repo.obtener(usuario.id, idPedido);
  if (!(TRANSICIONES[actual.Estado] ?? []).includes(estado)) {
    throw new AppError(409, `No se puede pasar de ${actual.Estado} a ${estado}`, 'TRANSICION_INVALIDA');
  }
  return repo.cambiarEstado(usuario.id, idPedido, estado, comentario);
}

export const { listar, obtener, registrarDevolucion, listarDevoluciones } = repo;
