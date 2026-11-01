// Estructura de la tienda: encabezado con buscador, menú lateral, contenido y menú inferior en celular.
// Al bajar se esconde el buscador y queda la barra compacta; al subir vuelve.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { api } from '../api/cliente';
import type { Categoria } from '../api/tipos';
import { useApi } from '../api/useApi';
import { esPersonal, useSesion } from '../sesion/SesionContexto';
import { useCarrito } from './CarritoContexto';
import { Icono } from './Iconos';

export const cargarCategorias = () => api<Categoria[]>('/categorias');

function useCompacto(): boolean {
  const [compacto, setCompacto] = useState(false);
  useEffect(() => {
    let ultimo = window.scrollY;
    function alDesplazar() {
      const y = window.scrollY;
      if (Math.abs(y - ultimo) < 8) return; // Ignora movimientos mínimos para que no parpadee.
      setCompacto(y > 60 && y > ultimo);
      ultimo = y;
    }
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

function MenuLateral({ cerrar }: { cerrar: () => void }) {
  const { usuario, cerrarSesion } = useSesion();
  const categorias = useApi(cargarCategorias, 'categorias');
  return (
    <div className="cortina" onClick={cerrar}>
      <nav className="menu-lateral" aria-label="Menú principal" onClick={(e) => e.stopPropagation()}>
        <div className="menu-lateral-cabeza">
          <span className="marca">ShopCart</span>
          <button type="button" className="boton-icono" aria-label="Cerrar menú" onClick={cerrar}>
            <Icono nombre="cerrar" />
          </button>
        </div>
        <div onClick={cerrar}>
          <p className="menu-lateral-titulo">{usuario ? `Hola, ${usuario.nombre}` : 'Te damos la bienvenida'}</p>
          <Link to="/">Inicio</Link>
          {usuario ? <Link to="/cuenta">Mi cuenta</Link> : <Link to="/login">Iniciar sesión</Link>}
          {!usuario && <Link to="/registro">Crear cuenta</Link>}
          {esPersonal(usuario?.rol) && <Link to="/panel">Panel de {usuario?.rol === 'Administrador' ? 'administración' : 'operación'}</Link>}
          <p className="menu-lateral-titulo">Categorías</p>
          {categorias.datos?.map((c) => (
            <Link key={c.IDCategoria} to={`/buscar?idCategoria=${c.IDCategoria}`}>
              {c.Nombre}
            </Link>
          ))}
          {categorias.error && <p className="texto-suave">No se pudieron cargar las categorías.</p>}
          {usuario && (
            <button type="button" className="boton-enlace menu-lateral-salir" onClick={() => void cerrarSesion()}>
              Cerrar sesión
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}

export function TiendaLayout() {
  const compacto = useCompacto();
  const { unidades } = useCarrito();
  const { usuario } = useSesion();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const cuenta = esPersonal(usuario?.rol) ? '/panel' : '/cuenta';

  return (
    <div className={`tienda ${compacto ? 'compacto' : ''}`}>
      <header className="encabezado">
        <div className="encabezado-barra">
          <button type="button" className="boton-icono" aria-label="Abrir menú" onClick={() => setMenuAbierto(true)}>
            <Icono nombre="menu" />
          </button>
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
        <div className="encabezado-buscador" aria-hidden={compacto || undefined}>
          <Buscador />
        </div>
      </header>

      {menuAbierto && <MenuLateral cerrar={() => setMenuAbierto(false)} />}

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
