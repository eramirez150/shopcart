// Exige sesión: sin ella manda al login y luego regresa aquí. Qué puede hacer cada
// usuario lo decide la API en cada petición.
import { Navigate, Outlet, useLocation } from 'react-router';
import { useSesion } from './SesionContexto';

export function RutaProtegida() {
  const { usuario } = useSesion();
  const ubicacion = useLocation();
  if (!usuario) {
    const volver = encodeURIComponent(ubicacion.pathname + ubicacion.search);
    return <Navigate to={`/login?volver=${volver}`} replace />;
  }
  return <Outlet />;
}
