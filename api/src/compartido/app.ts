import { readFileSync } from 'node:fs';
import cors from 'cors';
import express, { type Router } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';
import { config } from './config.js';
import { manejarErrores, noEncontrado } from '../middleware/error.js';

export interface Servicio {
  nombre: 'tienda' | 'admin';
  rutas: Record<string, Router>;
}

// Lo que comparten los dos servicios: seguridad, documentación, salud y errores.
export function crearApp({ nombre, rutas }: Servicio) {
  const app = express();
  app.disable('x-powered-by');
  // upgrade-insecure-requests se desactiva para poder abrir /api/docs por http en desarrollo.
  app.use(helmet({ contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null } } }));
  app.use(cors({ origin: config.corsOrigenes, allowedHeaders: ['Content-Type', 'Authorization', 'X-Carrito-Token'] }));
  app.use(express.json({ limit: '100kb' }));

  // Documentación: openapi.yaml escrito a mano, con botón Authorize para el JWT.
  const openapi = parse(readFileSync(new URL('../../openapi.yaml', import.meta.url), 'utf8')) as object;
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { swaggerOptions: { persistAuthorization: true } }));

  app.get('/api/salud', (_req, res) => {
    res.json({ estado: 'ok', servicio: nombre });
  });
  for (const [prefijo, router] of Object.entries(rutas)) app.use(prefijo, router);

  app.use(noEncontrado);
  app.use(manejarErrores);
  return app;
}
