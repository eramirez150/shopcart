import { Router } from 'express';
import { z } from 'zod';
import { autenticar, idUsuario } from '../../middleware/auth.js';
import { id } from '../../esquemas.js';
import * as servicio from './service.js';

export const rutasCheckout = Router();
rutasCheckout.use(autenticar);

// 1. Inicia el pago: reserva la existencia por 15 minutos con precios y descuento congelados.
rutasCheckout.post('/pagos', async (req, res) => {
  const b = z
    .object({
      direccion: z.string().trim().min(1).max(300),
      ciudad: z.string().trim().min(1).max(100),
      telefono: z.string().trim().min(1).max(20),
      codigoCupon: z.string().trim().min(1).max(30).optional(),
    })
    .parse(req.body);
  res.status(201).json(await servicio.iniciarPago(idUsuario(req), b, b.codigoCupon ?? null));
});

rutasCheckout.get('/reservas/:id', async (req, res) => {
  res.json(await servicio.obtenerReserva(idUsuario(req), id.parse(req.params.id)));
});

rutasCheckout.delete('/reservas/:id', async (req, res) => {
  res.json(await servicio.cancelarPago(idUsuario(req), id.parse(req.params.id)));
});

// 2. Confirma el pago (simulado): crea el pedido. Repetir la llamada devuelve el mismo pedido.
rutasCheckout.post('/reservas/:id/pedido', async (req, res) => {
  res.status(201).json(await servicio.crearPedido(idUsuario(req), id.parse(req.params.id)));
});
