// Deja pasar solo a los roles indicados. Sin sesión manda al login y luego regresa aquí.
import { Navigate, Outlet, useLocation } from 'react-router';
import type { Rol } from '../api/tipos';
import { MensajeError } from '../componentes/Estados';
import { useSesion } from './SesionContexto';

export function RutaProtegida({ roles }: { roles: Rol[] }) {
  const { usuario } = useSesion();
  const ubicacion = useLocation();
  if (!usuario) {
    const volver = encodeURIComponent(ubicacion.pathname + ubicacion.search);
    return <Navigate to={`/login?volver=${volver}`} replace />;
  }
  if (!roles.includes(usuario.rol)) {
    return (
      <main className="contenedor">
        <MensajeError titulo="Sin permiso" mensaje="Tu cuenta no tiene acceso a esta sección." />
      </main>
    );
  }
  return <Outlet />;
}
