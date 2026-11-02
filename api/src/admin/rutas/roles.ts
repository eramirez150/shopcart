import { Router } from 'express';
import { z } from 'zod';
import { autenticar, autorizar, idUsuario } from '../../middleware/auth.js';
import { id } from '../../compartido/esquemas.js';
import * as servicio from '../../modules/roles/service.js';

// Solo el Administrador tiene roles.gestionar y ningún otro rol lo puede recibir.
export const rutasRoles = Router();
export const rutasPermisos = Router();

rutasRoles.use(autenticar('admin'), autorizar('roles.gestionar'));
rutasPermisos.use(autenticar('admin'), autorizar('roles.gestionar'));

const rol = z.object({
  nombre: z.string().trim().min(1).max(20),
  descripcion: z.string().trim().max(200).nullish().transform((d) => d ?? null),
  permisos: z.array(z.string().min(1).max(50)).max(100),
});

rutasPermisos.get('/', async (req, res) => {
  res.json(await servicio.listarPermisos(idUsuario(req)));
});

rutasRoles.get('/', async (req, res) => {
  res.json(await servicio.listar(idUsuario(req)));
});

rutasRoles.get('/:id', async (req, res) => {
  res.json(await servicio.obtener(idUsuario(req), id.parse(req.params.id)));
});

rutasRoles.post('/', async (req, res) => {
  res.status(201).json(await servicio.crear(idUsuario(req), rol.parse(req.body)));
});

// Reemplaza el rol completo. No hay ruta para borrar: se desactiva con activo = false.
rutasRoles.put('/:id', async (req, res) => {
  const { activo, ...datos } = rol.extend({ activo: z.boolean().default(true) }).parse(req.body);
  res.json(await servicio.actualizar(idUsuario(req), id.parse(req.params.id), datos, activo));
});
