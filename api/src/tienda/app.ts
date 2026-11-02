import { crearApp } from '../compartido/app.js';
import { rutasCheckout } from './cliente/checkout.js';
import { rutasDirecciones } from './cliente/direcciones.js';
import { rutasPedidos } from './cliente/pedidos.js';
import { rutasAuth } from './publico/auth.js';
import { rutasCarrito } from './publico/carrito.js';
import { rutasCategorias, rutasProductos } from './publico/catalogo.js';

// Servicio de la tienda: /api/publico sin sesión y /api/cliente con sesión de Cliente.
export function crearAppTienda() {
  return crearApp({
    nombre: 'tienda',
    rutas: {
      '/api/publico/auth': rutasAuth,
      '/api/publico/categorias': rutasCategorias,
      '/api/publico/productos': rutasProductos,
      '/api/publico/carrito': rutasCarrito,
      '/api/cliente/direcciones': rutasDirecciones,
      '/api/cliente/checkout': rutasCheckout,
      '/api/cliente/pedidos': rutasPedidos,
    },
  });
}
