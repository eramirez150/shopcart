import type { NextFunction, Request, Response } from 'express';
import { AppError, traducir } from '../errors.js';

export function noEncontrado(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, 'Ruta no encontrada', 'NO_ENCONTRADO'));
}

// Manejo centralizado: toda excepción termina aquí con su código HTTP.
export function manejarErrores(e: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const error = traducir(e);
  if (error.estado >= 500) console.error(e);
  res.status(error.estado).json({ error: { codigo: error.codigo, mensaje: error.message, detalle: error.detalle } });
}
