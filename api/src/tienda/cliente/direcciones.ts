import { Router } from 'express';
import { z } from 'zod';
import { autenticar, idUsuario } from '../../middleware/auth.js';
import { id } from '../../compartido/esquemas.js';
import * as servicio from '../../modules/direcciones/service.js';

// Direcciones de entrega del usuario autenticado. El dueño sale siempre del JWT:
// la dirección de otro usuario responde 404.
export const rutasDirecciones = Router();
rutasDirecciones.use(autenticar);

export const datosDireccion = z.object({
  direccion: z.string().trim().min(1).max(300),
  ciudad: z.string().trim().min(1).max(100),
  telefono: z.string().trim().min(1).max(20),
});

rutasDirecciones.get('/', async (req, res) => {
  res.json(await servicio.listar(idUsuario(req)));
});

rutasDirecciones.post('/', async (req, res) => {
  res.status(201).json(await servicio.crear(idUsuario(req), datosDireccion.parse(req.body)));
});

rutasDirecciones.put('/:id', async (req, res) => {
  res.json(await servicio.actualizar(idUsuario(req), id.parse(req.params.id), datosDireccion.parse(req.body)));
});

// No se borra: se desactiva, porque puede estar en reservas y pedidos.
rutasDirecciones.delete('/:id', async (req, res) => {
  res.json(await servicio.desactivar(idUsuario(req), id.parse(req.params.id)));
});
