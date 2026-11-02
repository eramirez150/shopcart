// Estructura de la tienda: encabezado con buscador, contenido y menú inferior en celular.
// Al bajar se va el nombre y queda el buscador sobre blanco; apenas se sube vuelve el encabezado completo.
// En el detalle de producto queda fija solo la barra, con una flecha para volver y sin buscador.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { api } from '../api/cliente';
import type { Categoria } from '../api/tipos';
import { useSesion } from '../sesion/SesionContexto';
import { useCarrito } from './CarritoContexto';
import { Icono } from './Iconos';

export const cargarCategorias = () => api<Categoria[]>('/publico/categorias');

// Depende de la dirección: bajar pasados los 60 px compacta y subir restaura, esté donde esté la
// página. Los cambios de menos de 8 px se ignoran para que no parpadee con los gestos pequeños.
function useCompacto(): boolean {
  const [compacto, setCompacto] = useState(false);
  useEffect(() => {
    let ultimo = window.scrollY;
    const alDesplazar = () => {
      const y = window.scrollY;
      if (Math.abs(y - ultimo) < 8) return;
      setCompacto(y > ultimo && y > 60);
      ultimo = y;
    };
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
  const { pathname, key } = useLocation();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const pagina = params.get('pagina');

  // Sube al cambiar de ruta o de página de resultados; los demás filtros no mueven la vista.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, pagina]);

  const enDetalle = pathname.startsWith('/producto/');
  const clases = enDetalle ? 'tienda-detalle' : compacto ? 'compacto' : '';

  // La primera entrada del historial tiene la clave 'default': no hay a dónde regresar.
  const volver = () => {
    if (key === 'default') void navegar('/');
    else void navegar(-1);
  };

  return (
    <div className={`tienda ${clases}`}>
      <header className="encabezado">
        <div className="encabezado-barra">
          {enDetalle && (
            <button type="button" className="boton-icono" aria-label="Volver" onClick={volver}>
              <Icono nombre="atras" />
            </button>
          )}
          <Link to="/" className="marca">
            ShopCart
          </Link>
          <nav className="encabezado-enlaces" aria-label="Accesos">
            <NavLink to="/categorias">Categorías</NavLink>
            <NavLink to="/cuenta">{usuario ? 'Mi cuenta' : 'Iniciar sesión'}</NavLink>
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
        {!enDetalle && (
          <div className="encabezado-buscador">
            <Buscador />
          </div>
        )}
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
        <NavLink to="/cuenta">
          <Icono nombre="cuenta" />
          Mi cuenta
        </NavLink>
      </nav>
    </div>
  );
}
