import { Router } from 'express';
import { z } from 'zod';
import { autenticar, autenticarOpcional, autorizar, idUsuario } from '../../middleware/auth.js';
import { id, paginacion } from '../../compartido/esquemas.js';
import { veInactivos } from '../catalogo/service.js';
import * as servicio from './service.js';

// Se montan bajo /api/productos, antes de las rutas del catálogo.
export const rutasResenas = Router();

rutasResenas.get('/:id/resenas', autenticarOpcional, async (req, res) => {
  const q = z.object(paginacion).parse(req.query);
  res.json(await servicio.listar(id.parse(req.params.id), veInactivos(req.usuario?.rol), q.pagina, q.tamano));
});

rutasResenas.get('/:id/resenas/permiso', autenticar, async (req, res) => {
  res.json(await servicio.obtenerPermiso(idUsuario(req), id.parse(req.params.id)));
});

const resena = z.object({
  calificacion: z.number().int().min(1).max(5),
  comentario: z.string().trim().min(1).max(1000),
});

rutasResenas.post('/:id/resenas', autenticar, autorizar('Cliente'), async (req, res) => {
  const b = resena.parse(req.body);
  res.status(201).json(await servicio.crear(idUsuario(req), id.parse(req.params.id), b.calificacion, b.comentario));
});
