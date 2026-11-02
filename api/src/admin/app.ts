import { crearApp } from '../compartido/app.js';
import { rutasAuth } from './rutas/auth.js';
import { rutasCategorias, rutasProductos } from './rutas/catalogo.js';
import { rutasCupones } from './rutas/cupones.js';
import { rutasInventario } from './rutas/inventario.js';
import { rutasPedidos } from './rutas/pedidos.js';
import { rutasBitacora, rutasDashboard } from './rutas/reportes.js';
import { rutasUsuarios } from './rutas/usuarios.js';

// Servicio de administración: todo es privado salvo /api/admin/auth.
export function crearAppAdmin() {
  return crearApp({
    nombre: 'admin',
    rutas: {
      '/api/admin/auth': rutasAuth,
      '/api/admin/usuarios': rutasUsuarios,
      '/api/admin/categorias': rutasCategorias,
      '/api/admin/productos': rutasProductos,
      '/api/admin/inventario': rutasInventario,
      '/api/admin/cupones': rutasCupones,
      '/api/admin/pedidos': rutasPedidos,
      '/api/admin/dashboard': rutasDashboard,
      '/api/admin/bitacora': rutasBitacora,
    },
  });
}
