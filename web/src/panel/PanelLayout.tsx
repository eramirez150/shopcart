// Panel de operador y administrador: menú lateral con las opciones del rol.
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import type { Rol } from '../api/tipos';
import { useSesion } from '../sesion/SesionContexto';

interface Opcion {
  ruta: string;
  texto: string;
  roles: Rol[];
}

const PERSONAL: Rol[] = ['Operador', 'Administrador'];
const ADMIN: Rol[] = ['Administrador'];

// Cada opción indica qué roles la ven. Las rutas también están protegidas en App.tsx.
export const OPCIONES_PANEL: Opcion[] = [
  { ruta: '/panel', texto: 'Inicio', roles: PERSONAL },
  { ruta: '/panel/pedidos', texto: 'Pedidos y devoluciones', roles: PERSONAL },
  { ruta: '/panel/inventario', texto: 'Inventario y kardex', roles: PERSONAL },
  { ruta: '/panel/categorias', texto: 'Categorías', roles: ADMIN },
  { ruta: '/panel/productos', texto: 'Productos, variantes y precios', roles: ADMIN },
  { ruta: '/panel/cupones', texto: 'Cupones', roles: ADMIN },
  { ruta: '/panel/usuarios', texto: 'Usuarios', roles: ADMIN },
  { ruta: '/panel/bitacora', texto: 'Bitácora', roles: ADMIN },
];

export function PanelLayout() {
  const { usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const opciones = OPCIONES_PANEL.filter((o) => usuario && o.roles.includes(usuario.rol));

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
          {opciones.map((o) => (
            <NavLink key={o.ruta} to={o.ruta} end={o.ruta === '/panel'}>
              {o.texto}
            </NavLink>
          ))}
        </nav>
        <div className="panel-pie">
          <p>{usuario?.nombre}</p>
          <Link to="/">Ver la tienda</Link>
          <button type="button" className="boton boton-secundario" onClick={() => void salir()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="panel-contenido">
        <Outlet />
      </main>
    </div>
  );
}

export function PanelInicio() {
  const { usuario } = useSesion();
  const opciones = OPCIONES_PANEL.filter((o) => o.ruta !== '/panel' && usuario && o.roles.includes(usuario.rol));
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
