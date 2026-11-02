// Estructura de la tienda: encabezado con buscador, contenido y menú inferior en celular.
// Al bajar se va el nombre y queda el buscador sobre blanco; arriba de todo vuelve el encabezado completo.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { api } from '../api/cliente';
import type { Categoria } from '../api/tipos';
import { esPersonal, useSesion } from '../sesion/SesionContexto';
import { useCarrito } from './CarritoContexto';
import { Icono } from './Iconos';

export const cargarCategorias = () => api<Categoria[]>('/categorias');

// Depende de la posición y no de la dirección: así el color no cambia con cada gesto.
function useCompacto(): boolean {
  const [compacto, setCompacto] = useState(false);
  useEffect(() => {
    const alDesplazar = () => setCompacto(window.scrollY > 60);
    alDesplazar();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => window.removeEventListener('scroll', alDesplazar);
  }, []);
  return compacto;
}

function Buscador() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const [texto, setTexto] = useState(params.get('texto') ?? '');

  function buscar(e: FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    navegar(t ? `/buscar?texto=${encodeURIComponent(t)}` : '/buscar');
  }

  return (
    <form role="search" className="buscador" onSubmit={buscar}>
      <label htmlFor="buscar" className="oculto-visual">
        Buscar productos
      </label>
      <Icono nombre="buscar" />
      <input id="buscar" type="search" placeholder="Buscar productos" value={texto} maxLength={100} onChange={(e) => setTexto(e.target.value)} />
    </form>
  );
}

export function TiendaLayout() {
  const compacto = useCompacto();
  const { unidades } = useCarrito();
  const { usuario } = useSesion();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const pagina = params.get('pagina');

  // Sube al cambiar de ruta o de página de resultados; los demás filtros no mueven la vista.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, pagina]);

  const cuenta = esPersonal(usuario?.rol) ? '/panel' : '/cuenta';

  return (
    <div className={`tienda ${compacto ? 'compacto' : ''}`}>
      <header className="encabezado">
        <div className="encabezado-barra">
          <Link to="/" className="marca">
            ShopCart
          </Link>
          <nav className="encabezado-enlaces" aria-label="Accesos">
            <NavLink to="/categorias">Categorías</NavLink>
            <NavLink to={cuenta}>{usuario ? 'Mi cuenta' : 'Iniciar sesión'}</NavLink>
          </nav>
          <Link to="/carrito" className="boton-icono encabezado-carrito" aria-label={`Carrito, ${unidades} productos`}>
            <Icono nombre="carrito" />
            {unidades > 0 && (
              <span key={unidades} className="contador">
                {unidades > 99 ? '99+' : unidades}
              </span>
            )}
          </Link>
        </div>
        <div className="encabezado-buscador">
          <Buscador />
        </div>
      </header>

      {/* La clave reinicia la animación de entrada en cada página. */}
      <div className="tienda-contenido vista" key={pathname}>
        <Outlet />
      </div>

      <nav className="menu-inferior" aria-label="Menú inferior">
        <NavLink to="/" end>
          <Icono nombre="inicio" />
          Inicio
        </NavLink>
        <NavLink to="/categorias">
          <Icono nombre="categorias" />
          Categorías
        </NavLink>
        <NavLink to="/carrito">
          <span className="menu-inferior-carrito">
            <Icono nombre="carrito" />
            {unidades > 0 && (
              <span key={unidades} className="contador">
                {unidades > 99 ? '99+' : unidades}
              </span>
            )}
          </span>
          Carrito
        </NavLink>
        <NavLink to={cuenta}>
          <Icono nombre="cuenta" />
          Mi cuenta
        </NavLink>
      </nav>
    </div>
  );
}
