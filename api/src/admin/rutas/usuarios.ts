import { Router } from 'express';
import { z } from 'zod';
import { autenticar, autorizar, idUsuario } from '../../middleware/auth.js';
import { id, paginacion } from '../../compartido/esquemas.js';
import * as servicio from '../../modules/usuarios/service.js';

export const rutasUsuarios = Router();
rutasUsuarios.use(autenticar, autorizar('Administrador'));

const roles = z.enum(['Cliente', 'Operador', 'Administrador']);

rutasUsuarios.get('/', async (req, res) => {
  const q = z
    .object({ rol: roles.optional(), orden: z.enum(['id', 'nombre', 'correo', 'recientes']).default('id'), ...paginacion })
    .parse(req.query);
  res.json(await servicio.listar(idUsuario(req), q.rol ?? null, q.orden, q.pagina, q.tamano));
});

rutasUsuarios.post('/', async (req, res) => {
  const b = z
    .object({
      correo: z.email().max(150).transform((c) => c.toLowerCase()),
      clave: z.string().min(8).max(72),
      nombre: z.string().trim().min(1).max(100),
      rol: roles,
    })
    .parse(req.body);
  res.status(201).json(await servicio.crear(idUsuario(req), b.correo, b.clave, b.nombre, b.rol));
});

// Un usuario no se borra: se desactiva (activo = false) y se cierran sus sesiones.
rutasUsuarios.patch('/:id', async (req, res) => {
  const b = z.object({ rol: roles.optional(), activo: z.boolean().optional() }).parse(req.body);
  res.json(await servicio.actualizar(idUsuario(req), id.parse(req.params.id), b.rol ?? null, b.activo ?? null));
});
