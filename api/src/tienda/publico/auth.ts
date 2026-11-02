import { Router } from 'express';
import { z } from 'zod';
import { tokenInvitado } from '../../middleware/auth.js';
import { correo, refreshToken } from '../../compartido/esquemas.js';
import * as servicio from '../../modules/auth/service.js';

export const rutasAuth = Router();

// Mínimo 8 caracteres; bcrypt solo usa los primeros 72 bytes.
const clave = z.string().min(8).max(72);

rutasAuth.post('/registro', async (req, res) => {
  const b = z.object({ correo, clave, nombre: z.string().trim().min(1).max(100) }).parse(req.body);
  res.status(201).json(await servicio.registrar(b.correo, b.clave, b.nombre));
});

rutasAuth.post('/login', async (req, res) => {
  const b = z.object({ correo, clave: z.string().min(1).max(72) }).parse(req.body);
  res.json(await servicio.iniciarSesion(b.correo, b.clave, tokenInvitado(req)));
});

rutasAuth.post('/refresh', async (req, res) => {
  const b = z.object({ refreshToken }).parse(req.body);
  res.json(await servicio.renovar(b.refreshToken));
});

rutasAuth.post('/logout', async (req, res) => {
  const b = z.object({ refreshToken }).parse(req.body);
  await servicio.cerrarSesion(b.refreshToken);
  res.status(204).end();
});
