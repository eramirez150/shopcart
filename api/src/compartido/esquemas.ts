import { z } from 'zod';

// Esquemas compartidos por las rutas.
export const id = z.coerce.number().int().positive();
export const paginacion = {
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20),
};
export const fecha = z.iso.date();
export const dinero = z.number().min(0).multipleOf(0.01);
