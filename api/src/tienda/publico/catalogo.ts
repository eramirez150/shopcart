import { Router } from 'express';
import { z } from 'zod';
import { booleano, id, paginacion } from '../../compartido/esquemas.js';
import * as servicio from '../../modules/catalogo/service.js';

// Catálogo público: solo muestra lo activo.
export const rutasCategorias = Router();
export const rutasProductos = Router();

rutasCategorias.get('/', async (_req, res) => {
  res.json(await servicio.listarCategorias(false));
});

rutasProductos.get('/', async (req, res) => {
  const q = z
    .object({
      texto: z.string().trim().max(100).optional(),
      idCategoria: id.optional(),
      precioMin: z.coerce.number().min(0).optional(),
      precioMax: z.coerce.number().min(0).optional(),
      soloDisponibles: booleano.default(false),
      orden: z.enum(['nombre', 'precio_asc', 'precio_desc', 'recientes']).default('nombre'),
      ...paginacion,
    })
    .parse(req.query);
  res.json(await servicio.buscar(q));
});

rutasProductos.get('/:id', async (req, res) => {
  res.json(await servicio.obtenerProducto(id.parse(req.params.id), false));
});
