import { Router } from 'express';
import { z } from 'zod';
import { autenticar, autorizar, idUsuario } from '../../middleware/auth.js';
import { fecha, id, paginacion } from '../../esquemas.js';
import * as servicio from './service.js';

export const rutasPedidos = Router();
rutasPedidos.use(autenticar);

const estados = ['Pagado', 'EnPreparacion', 'Despachado', 'Entregado', 'DevueltoParcial', 'Devuelto', 'Cancelado'] as const;

// El Cliente solo ve sus pedidos: el SP lo fuerza con el usuario del JWT.
rutasPedidos.get('/', async (req, res) => {
  const q = z
    .object({
      estado: z.enum(estados).optional(),
      desde: fecha.optional(),
      hasta: fecha.optional(),
      idCliente: id.optional(),
      totalMin: z.coerce.number().min(0).optional(),
      totalMax: z.coerce.number().min(0).optional(),
      ...paginacion,
    })
    .parse(req.query);
  res.json(await servicio.listar(idUsuario(req), q));
});

rutasPedidos.get('/:id', async (req, res) => {
  res.json(await servicio.obtener(idUsuario(req), id.parse(req.params.id)));
});

// El Operador avanza los estados; el Cliente solo puede cancelar el suyo.
rutasPedidos.patch('/:id/estado', async (req, res) => {
  const b = z
    .object({ estado: z.enum(['EnPreparacion', 'Despachado', 'Entregado', 'Cancelado']), comentario: z.string().trim().max(300).nullish() })
    .parse(req.body);
  if (req.usuario!.rol === 'Cliente' && b.estado !== 'Cancelado') {
    res.status(403).json({ error: { codigo: 'PROHIBIDO', mensaje: 'El cliente solo puede cancelar su pedido' } });
    return;
  }
  res.json(await servicio.cambiarEstado(req.usuario!, id.parse(req.params.id), b.estado, b.comentario ?? null));
});

rutasPedidos.get('/:id/devoluciones', async (req, res) => {
  res.json(await servicio.listarDevoluciones(idUsuario(req), id.parse(req.params.id)));
});

rutasPedidos.post('/:id/devoluciones', autorizar('Operador', 'Administrador'), async (req, res) => {
  const b = z
    .object({
      motivo: z.string().trim().min(1).max(300),
      lineas: z.array(z.object({ idPedidoDetalle: id, cantidad: z.number().int().positive() })).min(1).max(100),
    })
    .parse(req.body);
  res.status(201).json(await servicio.registrarDevolucion(idUsuario(req), id.parse(req.params.id), b.motivo, b.lineas));
});
