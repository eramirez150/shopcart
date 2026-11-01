import { Router } from 'express';
import { z } from 'zod';
import { autenticar, autorizar, idUsuario } from '../../middleware/auth.js';
import { fecha, paginacion } from '../../compartido/esquemas.js';
import * as servicio from './service.js';

export const rutasDashboard = Router();
export const rutasBitacora = Router();

rutasDashboard.use(autenticar, autorizar('Administrador'));
rutasBitacora.use(autenticar, autorizar('Administrador'));

const filtroFechas = { desde: fecha.optional(), hasta: fecha.optional() };
const rangoDe = (q: { desde?: string | undefined; hasta?: string | undefined }) =>
  servicio.validarRango({ ...(q.desde && { desde: q.desde }), ...(q.hasta && { hasta: q.hasta }) });

rutasDashboard.get('/ventas', async (req, res) => {
  const q = z.object({ agrupacion: z.enum(['Dia', 'Semana', 'Mes']).default('Dia'), ...filtroFechas }).parse(req.query);
  res.json(await servicio.ventasPorPeriodo(idUsuario(req), q.agrupacion, rangoDe(q)));
});

rutasDashboard.get('/categorias', async (req, res) => {
  const q = z.object(filtroFechas).parse(req.query);
  res.json(await servicio.ventasPorCategoria(idUsuario(req), rangoDe(q)));
});

rutasDashboard.get('/top-productos', async (req, res) => {
  const q = z.object({ cantidad: z.coerce.number().int().min(1).max(50).default(10), ...filtroFechas }).parse(req.query);
  res.json(await servicio.topProductos(idUsuario(req), rangoDe(q), q.cantidad));
});

rutasDashboard.get('/indicadores', async (req, res) => {
  const q = z.object({ horas: z.coerce.number().int().min(1).max(8760).default(24), ...filtroFechas }).parse(req.query);
  res.json(await servicio.indicadores(idUsuario(req), rangoDe(q), q.horas));
});

rutasDashboard.get('/carritos-abandonados', async (req, res) => {
  const q = z.object({ horas: z.coerce.number().int().min(1).max(8760).default(24), ...paginacion }).parse(req.query);
  res.json(await servicio.carritosAbandonados(idUsuario(req), q.horas, q.pagina, q.tamano));
});

// El listado filtrado de pedidos del dashboard es GET /api/pedidos (ver módulo de pedidos).

rutasBitacora.get('/', async (req, res) => {
  const q = z
    .object({
      modulo: z.enum(['Catalogo', 'Inventario', 'Cupones', 'Pedidos']).optional(),
      orden: z.enum(['recientes', 'antiguos']).default('recientes'),
      ...filtroFechas,
      ...paginacion,
    })
    .parse(req.query);
  res.json(await servicio.bitacora(idUsuario(req), q.modulo ?? null, rangoDe(q), q.orden, q.pagina, q.tamano));
});
