// Deja pasar solo a los roles indicados. Sin sesión manda al login y luego regresa aquí.
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import type { Rol } from '../api/tipos';
import { MensajeError } from '../componentes/Estados';
import { useSesion } from './SesionContexto';

// Dentro del panel ya hay un <main>: enPanel evita anidar otro.
export function RutaProtegida({ roles, enPanel = false }: { roles: Rol[]; enPanel?: boolean }) {
  const { usuario } = useSesion();
  const ubicacion = useLocation();
  if (!usuario) {
    const volver = encodeURIComponent(ubicacion.pathname + ubicacion.search);
    return <Navigate to={`/login?volver=${volver}`} replace />;
  }
  if (!roles.includes(usuario.rol)) {
    const Contenedor = enPanel ? 'div' : 'main';
    return (
      <Contenedor className="contenedor">
        <MensajeError titulo="Sin permiso" mensaje="Tu cuenta no tiene acceso a esta sección." />
        <div className="estado-cuerpo">
          <Link to="/" className="boton boton-principal">
            Ir a la tienda
          </Link>
        </div>
      </Contenedor>
    );
  }
  return <Outlet />;
}
