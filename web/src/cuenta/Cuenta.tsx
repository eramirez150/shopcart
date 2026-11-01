// Mi cuenta: datos del cliente y accesos a pedidos y direcciones.
import { Link, useNavigate } from 'react-router';
import { useSesion } from '../sesion/SesionContexto';

export function Cuenta() {
  const { usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();
  return (
    <main className="contenedor cuenta">
      <h1>Mi cuenta</h1>
      <p>
        <strong>{usuario?.nombre}</strong>
        <br />
        <span className="texto-suave">{usuario?.correo}</span>
      </p>
      <nav className="accesos">
        <Link to="/cuenta/pedidos" className="acceso">
          Mis pedidos
        </Link>
        <Link to="/cuenta/direcciones" className="acceso">
          Mis direcciones
        </Link>
      </nav>
      <button
        type="button"
        className="boton boton-secundario cuenta-salir"
        onClick={async () => {
          await cerrarSesion();
          navegar('/');
        }}
      >
        Cerrar sesión
      </button>
    </main>
  );
}
