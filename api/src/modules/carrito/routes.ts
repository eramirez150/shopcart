import { Router } from 'express';
import { z } from 'zod';
import { autenticarOpcional, tokenInvitado } from '../../middleware/auth.js';
import { id } from '../../compartido/esquemas.js';
import * as servicio from './service.js';

export const rutasCarrito = Router();
rutasCarrito.use(autenticarOpcional);

const cantidad = z.number().int().min(1).max(1000);
const dueno = (req: Parameters<typeof tokenInvitado>[0]) => servicio.duenoDe(req.usuario, tokenInvitado(req));

rutasCarrito.get('/', async (req, res) => {
  res.json(await servicio.obtener(dueno(req)));
});

rutasCarrito.post('/items', async (req, res) => {
  const b = z.object({ idVariante: id, cantidad }).parse(req.body);
  res.status(201).json(await servicio.agregar(dueno(req), b.idVariante, b.cantidad));
});

rutasCarrito.patch('/items/:idVariante', async (req, res) => {
  const b = z.object({ cantidad }).parse(req.body);
  res.json(await servicio.modificar(dueno(req), id.parse(req.params.idVariante), b.cantidad));
});

rutasCarrito.delete('/items/:idVariante', async (req, res) => {
  res.json(await servicio.eliminar(dueno(req), id.parse(req.params.idVariante)));
});

rutasCarrito.put('/cupon', async (req, res) => {
  const b = z.object({ codigo: z.string().trim().min(1).max(30) }).parse(req.body);
  res.json(await servicio.aplicarCupon(req.usuario, b.codigo));
});

rutasCarrito.delete('/cupon', async (req, res) => {
  res.json(await servicio.quitarCupon(req.usuario));
});
