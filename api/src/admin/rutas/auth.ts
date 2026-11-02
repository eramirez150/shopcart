import { Router } from 'express';
import { z } from 'zod';
import { correo, refreshToken } from '../../compartido/esquemas.js';
import * as servicio from '../../modules/auth/service.js';

// Sesión del personal. Aquí no hay registro: los usuarios internos los crea un administrador.
export const rutasAuth = Router();

rutasAuth.post('/login', async (req, res) => {
  const b = z.object({ correo, clave: z.string().min(1).max(72) }).parse(req.body);
  res.json(await servicio.iniciarSesion(b.correo, b.clave, 'admin'));
});

rutasAuth.post('/refresh', async (req, res) => {
  const b = z.object({ refreshToken }).parse(req.body);
  res.json(await servicio.renovar(b.refreshToken, 'admin'));
});

rutasAuth.post('/logout', async (req, res) => {
  const b = z.object({ refreshToken }).parse(req.body);
  await servicio.cerrarSesion(b.refreshToken, 'admin');
  res.status(204).end();
});
