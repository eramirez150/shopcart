import { Router } from 'express';
import { z } from 'zod';
import { autenticar, autorizar, idUsuario } from '../../middleware/auth.js';
import { cambioEstadoAdmin, filtrosPedidos, id, MAX_INT } from '../../compartido/esquemas.js';
import * as servicio from '../../modules/pedidos/service.js';

export const rutasPedidos = Router();
rutasPedidos.use(autenticar('admin'));

rutasPedidos.get('/', autorizar('pedidos.ver'), async (req, res) => {
  res.json(await servicio.listar(idUsuario(req), filtrosPedidos.extend({ idCliente: id.optional() }).parse(req.query)));
});

rutasPedidos.get('/:id', autorizar('pedidos.ver'), async (req, res) => {
  res.json(await servicio.obtener(idUsuario(req), id.parse(req.params.id)));
});

rutasPedidos.patch('/:id/estado', autorizar('pedidos.gestionar'), async (req, res) => {
  const { estado, comentario, ...envio } = cambioEstadoAdmin.parse(req.body);
  res.json(await servicio.cambiarEstado(req.usuario!, id.parse(req.params.id), estado, comentario ?? null, envio));
});

rutasPedidos.get('/:id/devoluciones', autorizar('pedidos.ver'), async (req, res) => {
  res.json(await servicio.listarDevoluciones(idUsuario(req), id.parse(req.params.id)));
});

rutasPedidos.post('/:id/devoluciones', autorizar('pedidos.gestionar'), async (req, res) => {
  const b = z
    .object({
      motivo: z.string().trim().min(1).max(300),
      lineas: z.array(z.object({ idPedidoDetalle: id, cantidad: z.number().int().positive().max(MAX_INT) })).min(1).max(100),
    })
    .parse(req.body);
  res.status(201).json(await servicio.registrarDevolucion(idUsuario(req), id.parse(req.params.id), b.motivo, b.lineas));
});
