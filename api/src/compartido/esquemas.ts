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
