import { Link } from 'react-router';
import { Vacio } from './Estados';

// Dentro del panel ya hay un <main>: enPanel evita anidar otro.
export function NoEncontrada({ enPanel = false }: { enPanel?: boolean }) {
  const Contenedor = enPanel ? 'div' : 'main';
  return (
    <Contenedor className="contenedor">
      <Vacio titulo="Esta página no existe" ilustracion="busqueda">
        <Link to="/" className="boton boton-principal">
          Ir al inicio
        </Link>
      </Vacio>
    </Contenedor>
  );
}
