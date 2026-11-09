// Panel del personal: menú lateral. El login no informa los permisos del usuario, así que
// se muestran todas las secciones y cada una dice "sin permiso" si la API responde 403.
// Roles es la excepción: roles.gestionar es exclusivo del Administrador y no se asigna.
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import type { Usuario } from '../api/tipos';
import { useSesion } from '../sesion/SesionContexto';

interface OpcionPanel {
  ruta: string;
  texto: string;
  soloAdministrador?: boolean;
}

export const OPCIONES_PANEL: OpcionPanel[] = [
  { ruta: '/panel', texto: 'Inicio' },
  { ruta: '/panel/dashboard', texto: 'Dashboard' },
  { ruta: '/panel/pedidos', texto: 'Pedidos y devoluciones' },
  { ruta: '/panel/inventario', texto: 'Inventario y kardex' },
  { ruta: '/panel/categorias', texto: 'Categorías' },
  { ruta: '/panel/productos', texto: 'Productos, variantes y precios' },
  { ruta: '/panel/cupones', texto: 'Cupones' },
  { ruta: '/panel/usuarios', texto: 'Usuarios' },
  { ruta: '/panel/roles', texto: 'Roles', soloAdministrador: true },
  { ruta: '/panel/bitacora', texto: 'Bitácora' },
];

const visibles = (usuario: Usuario | null | undefined) => OPCIONES_PANEL.filter((o) => !o.soloAdministrador || usuario?.rol === 'Administrador');

export function PanelLayout() {
  const { usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();

  async function salir() {
    await cerrarSesion();
    navegar('/login');
  }

  return (
    <div className="panel">
      <header className="panel-barra">
        <button type="button" className="boton-icono panel-menu-boton" aria-label="Abrir menú" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Link to="/panel" className="marca">
          ShopCart <span className="panel-rol">{usuario?.rol}</span>
        </Link>
      </header>
      <aside className={`panel-lateral ${abierto ? 'abierto' : ''}`}>
        <nav aria-label="Menú del panel" onClick={() => setAbierto(false)}>
          {visibles(usuario).map((o) => (
            <NavLink key={o.ruta} to={o.ruta} end={o.ruta === '/panel'}>
              {o.texto}
            </NavLink>
          ))}
        </nav>
        <div className="panel-pie">
          <p>{usuario?.nombre}</p>
          <button type="button" className="boton boton-secundario" onClick={() => void salir()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="panel-contenido vista" key={pathname}>
        <Outlet />
      </main>
    </div>
  );
}

export function PanelInicio() {
  const { usuario } = useSesion();
  const opciones = visibles(usuario).filter((o) => o.ruta !== '/panel');
  return (
    <section>
      <h1>Hola, {usuario?.nombre}</h1>
      <p className="texto-suave">Elige una sección del menú.</p>
      <div className="accesos">
        {opciones.map((o) => (
          <Link key={o.ruta} to={o.ruta} className="acceso">
            {o.texto}
          </Link>
        ))}
      </div>
    </section>
  );
}
