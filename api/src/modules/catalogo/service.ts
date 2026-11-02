import { AppError } from '../../compartido/errors.js';
import * as repo from './repository.js';

// La búsqueda es pública; los precios y el stock salen de la base.

export const buscar = (f: repo.FiltrosBusqueda) => {
  if (f.precioMin !== undefined && f.precioMax !== undefined && f.precioMin > f.precioMax) {
    throw new AppError(400, 'precioMin no puede ser mayor que precioMax', 'VALIDACION');
  }
  return repo.buscarProductos(f);
};

export const { listarCategorias, crearCategoria, actualizarCategoria, eliminarCategoria } = repo;
export const { obtenerProducto, crearProducto, actualizarProducto, eliminarProducto, crearVariante, actualizarVariante } = repo;
export const { agregarImagen, eliminarImagen, listarAdministracion } = repo;
