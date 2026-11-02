import { Router } from 'express';
import { z } from 'zod';
import { autenticar, idUsuario } from '../../middleware/auth.js';
import { id } from '../../compartido/esquemas.js';
import * as servicio from '../../modules/checkout/service.js';

export const rutasCheckout = Router();
rutasCheckout.use(autenticar('tienda'));

// 1. Inicia el pago: reserva la existencia por 15 minutos con precios y descuento congelados.
// La dirección se elige con idDireccion (una de /api/cliente/direcciones) o se registra enviando
// direccion, ciudad y telefono.
rutasCheckout.post('/pagos', async (req, res) => {
  const b = z
    .object({
      idDireccion: id.optional(),
      direccion: z.string().trim().min(1).max(300).optional(),
      ciudad: z.string().trim().min(1).max(100).optional(),
      telefono: z.string().trim().min(1).max(20).optional(),
      codigoCupon: z.string().trim().min(1).max(30).optional(),
    })
    .refine((d) => d.idDireccion !== undefined || (d.direccion && d.ciudad && d.telefono), {
      message: 'Envíe idDireccion o direccion, ciudad y telefono',
      path: ['idDireccion'],
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
