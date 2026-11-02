import { Router } from 'express';
import { z } from 'zod';
import { autenticar, autorizar, idUsuario } from '../../middleware/auth.js';
import { dinero, id, MAX_INT, paginacion } from '../../compartido/esquemas.js';
import * as servicio from '../../modules/cupones/service.js';

export const rutasCupones = Router();
rutasCupones.use(autenticar('admin'), autorizar('Administrador'));

const cupon = z.object({
  tipo: z.enum(['Porcentaje', 'Monto']),
  valor: dinero.positive(),
  fechaInicio: z.iso.datetime().transform((f) => new Date(f)),
  fechaFin: z.iso.datetime().transform((f) => new Date(f)),
  minimoCompra: dinero.default(0),
  limiteTotal: z.number().int().positive().max(MAX_INT).nullable().default(null),
  limitePorCliente: z.number().int().positive().max(MAX_INT).nullable().default(null),
  idCategoria: id.nullable().default(null),
});

rutasCupones.get('/', async (req, res) => {
  const q = z.object({ orden: z.enum(['id', 'codigo', 'vence', 'usos']).default('id'), ...paginacion }).parse(req.query);
  res.json(await servicio.listar(idUsuario(req), q.orden, q.pagina, q.tamano));
});

rutasCupones.post('/', async (req, res) => {
  const { codigo, ...c } = cupon.extend({ codigo: z.string().trim().min(1).max(30) }).parse(req.body);
  res.status(201).json(await servicio.crear(idUsuario(req), codigo, c));
});

rutasCupones.put('/:id', async (req, res) => {
  const { activo, ...c } = cupon.extend({ activo: z.boolean().default(true) }).parse(req.body);
  res.json(await servicio.actualizar(idUsuario(req), id.parse(req.params.id), c, activo));
});
