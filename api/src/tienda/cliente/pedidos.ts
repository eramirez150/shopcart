import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../compartido/errors.js';
import { autenticar, idUsuario } from '../../middleware/auth.js';
import { estadosManuales, filtrosPedidos, id } from '../../compartido/esquemas.js';
import * as servicio from '../../modules/pedidos/service.js';

// Pedidos del cliente autenticado: el SP solo devuelve los suyos.
export const rutasPedidos = Router();
rutasPedidos.use(autenticar);

rutasPedidos.get('/', async (req, res) => {
  res.json(await servicio.listar(idUsuario(req), filtrosPedidos.parse(req.query)));
});

rutasPedidos.get('/:id', async (req, res) => {
  res.json(await servicio.obtener(idUsuario(req), id.parse(req.params.id)));
});

// El cliente solo puede cancelar su pedido.
rutasPedidos.patch('/:id/estado', async (req, res) => {
  const b = z.object({ estado: estadosManuales, comentario: z.string().trim().max(300).nullish() }).parse(req.body);
  if (b.estado !== 'Cancelado') throw new AppError(403, 'El cliente solo puede cancelar su pedido', 'PROHIBIDO');
  res.json(await servicio.cambiarEstado(req.usuario!, id.parse(req.params.id), b.estado, b.comentario ?? null));
});

rutasPedidos.get('/:id/devoluciones', async (req, res) => {
  res.json(await servicio.listarDevoluciones(idUsuario(req), id.parse(req.params.id)));
});
