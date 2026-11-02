import { Router } from 'express';
import { z } from 'zod';
import { autenticar, autorizar, idUsuario } from '../../middleware/auth.js';
import { id, MAX_INT, paginacion } from '../../compartido/esquemas.js';
import * as servicio from '../../modules/inventario/service.js';

export const rutasInventario = Router();
rutasInventario.use(autenticar('admin'));

rutasInventario.get('/existencias', autorizar('inventario.ver'), async (req, res) => {
  const q = z
    .object({
      umbral: z.coerce.number().int().min(0).max(MAX_INT).optional(),
      orden: z.enum(['disponible', 'disponible_desc', 'sku', 'producto']).default('disponible'),
      ...paginacion,
    })
    .parse(req.query);
  res.json(await servicio.existencias(idUsuario(req), q.umbral ?? null, q.orden, q.pagina, q.tamano));
});

rutasInventario.get('/variantes/:id/kardex', autorizar('inventario.ver'), async (req, res) => {
  const q = z.object({ orden: z.enum(['recientes', 'antiguos']).default('recientes'), ...paginacion }).parse(req.query);
  res.json(await servicio.kardex(idUsuario(req), id.parse(req.params.id), q.orden, q.pagina, q.tamano));
});

rutasInventario.post('/movimientos', autorizar('inventario.gestionar'), async (req, res) => {
  const b = z
    .object({
      idVariante: id,
      tipo: z.enum(['Entrada', 'Salida', 'Ajuste']),
      cantidad: z.number().int().min(-MAX_INT).max(MAX_INT),
      motivo: z.string().trim().min(1).max(300),
    })
    .parse(req.body);
  res.status(201).json(await servicio.registrarMovimiento(idUsuario(req), b.idVariante, b.tipo, b.cantidad, b.motivo));
});
