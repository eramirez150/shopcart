import { Router } from 'express';
import { z } from 'zod';
import { autenticar, autorizar, idUsuario } from '../../middleware/auth.js';
import { estadosManuales, filtrosPedidos, id, MAX_INT } from '../../compartido/esquemas.js';
import * as servicio from '../../modules/pedidos/service.js';

export const rutasPedidos = Router();
rutasPedidos.use(autenticar('admin'), autorizar('Operador', 'Administrador'));

rutasPedidos.get('/', async (req, res) => {
  res.json(await servicio.listar(idUsuario(req), filtrosPedidos.extend({ idCliente: id.optional() }).parse(req.query)));
});

rutasPedidos.get('/:id', async (req, res) => {
  res.json(await servicio.obtener(idUsuario(req), id.parse(req.params.id)));
});

rutasPedidos.patch('/:id/estado', async (req, res) => {
  const b = z.object({ estado: estadosManuales, comentario: z.string().trim().max(300).nullish() }).parse(req.body);
  res.json(await servicio.cambiarEstado(req.usuario!, id.parse(req.params.id), b.estado, b.comentario ?? null));
});

rutasPedidos.get('/:id/devoluciones', async (req, res) => {
  res.json(await servicio.listarDevoluciones(idUsuario(req), id.parse(req.params.id)));
});

rutasPedidos.post('/:id/devoluciones', async (req, res) => {
  const b = z
    .object({
      motivo: z.string().trim().min(1).max(300),
      lineas: z.array(z.object({ idPedidoDetalle: id, cantidad: z.number().int().positive().max(MAX_INT) })).min(1).max(100),
    })
    .parse(req.body);
  res.status(201).json(await servicio.registrarDevolucion(idUsuario(req), id.parse(req.params.id), b.motivo, b.lineas));
});
