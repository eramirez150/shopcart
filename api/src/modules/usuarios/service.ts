import bcrypt from 'bcryptjs';
import * as repo from './repository.js';

export async function crear(idUsuario: number, correo: string, clave: string, nombre: string, rol: string) {
  return repo.crear(idUsuario, correo, await bcrypt.hash(clave, 10), nombre, rol);
}

export const { listar, actualizar } = repo;
