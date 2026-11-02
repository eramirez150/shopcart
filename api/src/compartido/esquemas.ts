import { z } from 'zod';

// Esquemas compartidos por las rutas. Los topes evitan valores que no caben en SQL Server.
export const MAX_INT = 2147483647;
export const id = z.coerce.number().int().positive().max(MAX_INT);
export const paginacion = {
  // (pagina - 1) * tamano también debe caber en INT.
  pagina: z.coerce.number().int().min(1).max(1000000).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20),
};
export const fecha = z.iso.date();
export const dinero = z.number().min(0).max(9999999999.99).multipleOf(0.01);
export const booleano = z.enum(['true', 'false']).transform((v) => v === 'true');
export const correo = z.email().max(150).transform((c) => c.toLowerCase());
export const refreshToken = z.string().min(20).max(200);

const estadosPedido = ['Pagado', 'EnPreparacion', 'Despachado', 'Entregado', 'DevueltoParcial', 'Devuelto', 'Cancelado'] as const;
// Estados que se piden a mano: los de devolución se alcanzan registrando una devolución.
export const estadosManuales = z.enum(['EnPreparacion', 'Despachado', 'Entregado', 'Cancelado']);
export const filtrosPedidos = z.object({
  estado: z.enum(estadosPedido).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
  totalMin: z.coerce.number().min(0).optional(),
  totalMax: z.coerce.number().min(0).optional(),
  orden: z.enum(['recientes', 'antiguos', 'total_desc', 'total_asc']).default('recientes'),
  ...paginacion,
});
