import { readFileSync } from 'node:fs';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';
import { config } from './compartido/config.js';
import { manejarErrores, noEncontrado } from './middleware/error.js';
import { rutasAuth } from './modules/auth/routes.js';
import { rutasCarrito } from './modules/carrito/routes.js';
import { rutasCategorias, rutasProductos } from './modules/catalogo/routes.js';
import { rutasCheckout } from './modules/checkout/routes.js';
import { rutasCupones } from './modules/cupones/routes.js';
import { rutasInventario } from './modules/inventario/routes.js';
import { rutasPedidos } from './modules/pedidos/routes.js';
import { rutasBitacora, rutasDashboard } from './modules/reportes/routes.js';
import { rutasUsuarios } from './modules/usuarios/routes.js';

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  // upgrade-insecure-requests se desactiva para poder abrir /api/docs por http en desarrollo.
  app.use(helmet({ contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null } } }));
  app.use(cors({ origin: config.corsOrigenes, allowedHeaders: ['Content-Type', 'Authorization', 'X-Carrito-Token'] }));
  app.use(express.json({ limit: '100kb' }));

  // Documentación: openapi.yaml escrito a mano, con botón Authorize para el JWT.
  const openapi = parse(readFileSync(new URL('../openapi.yaml', import.meta.url), 'utf8')) as object;
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { swaggerOptions: { persistAuthorization: true } }));

  app.get('/api/salud', (_req, res) => {
    res.json({ estado: 'ok' });
  });
  app.use('/api/auth', rutasAuth);
  app.use('/api/usuarios', rutasUsuarios);
  app.use('/api/categorias', rutasCategorias);
  app.use('/api/productos', rutasProductos);
  app.use('/api/inventario', rutasInventario);
  app.use('/api/carrito', rutasCarrito);
  app.use('/api/cupones', rutasCupones);
  app.use('/api/checkout', rutasCheckout);
  app.use('/api/pedidos', rutasPedidos);
  app.use('/api/dashboard', rutasDashboard);
  app.use('/api/bitacora', rutasBitacora);

  app.use(noEncontrado);
  app.use(manejarErrores);
  return app;
}
