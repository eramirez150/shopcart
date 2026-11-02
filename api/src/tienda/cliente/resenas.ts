import { Router } from 'express';
import { z } from 'zod';
import { autenticar, idUsuario } from '../../middleware/auth.js';
import { id } from '../../compartido/esquemas.js';
import * as servicio from '../../modules/resenas/service.js';

// Reseñas del cliente autenticado. Quién puede reseñar lo decide el SP.
export const rutasResenas = Router();
rutasResenas.use(autenticar('tienda'));

const resena = z.object({
  calificacion: z.number().int().min(1).max(5),
  comentario: z.string().trim().min(1).max(1000),
});

rutasResenas.get('/:id/resenas/permiso', async (req, res) => {
  res.json(await servicio.obtenerPermiso(idUsuario(req), id.parse(req.params.id)));
});

rutasResenas.post('/:id/resenas', async (req, res) => {
  const b = resena.parse(req.body);
  res.status(201).json(await servicio.crear(idUsuario(req), id.parse(req.params.id), b.calificacion, b.comentario));
});
