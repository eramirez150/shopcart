import { Router } from 'express';
import { z } from 'zod';
import { autenticar, autorizar, idUsuario } from '../../middleware/auth.js';
import { id, paginacion } from '../../compartido/esquemas.js';
import * as servicio from './service.js';

export const rutasInventario = Router();
rutasInventario.use(autenticar, autorizar('Operador', 'Administrador'));

rutasInventario.get('/existencias', async (req, res) => {
  const q = z
    .object({
      umbral: z.coerce.number().int().min(0).optional(),
      orden: z.enum(['disponible', 'disponible_desc', 'sku', 'producto']).default('disponible'),
      ...paginacion,
    })
    .parse(req.query);
  res.json(await servicio.existencias(q.umbral ?? null, q.orden, q.pagina, q.tamano));
});

rutasInventario.get('/variantes/:id/kardex', async (req, res) => {
  const q = z.object({ orden: z.enum(['recientes', 'antiguos']).default('recientes'), ...paginacion }).parse(req.query);
  res.json(await servicio.kardex(id.parse(req.params.id), q.orden, q.pagina, q.tamano));
});

rutasInventario.post('/movimientos', async (req, res) => {
  const b = z
    .object({
      idVariante: id,
      tipo: z.enum(['Entrada', 'Salida', 'Ajuste']),
      cantidad: z.number().int(),
      motivo: z.string().trim().min(1).max(300),
    })
    .parse(req.body);
  res.status(201).json(await servicio.registrarMovimiento(idUsuario(req), b.idVariante, b.tipo, b.cantidad, b.motivo));
});
