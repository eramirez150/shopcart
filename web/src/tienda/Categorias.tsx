// Todas las categorías activas.
import { Link } from 'react-router';
import { useApi } from '../api/useApi';
import { EsqueletoFilas, MensajeError, Vacio } from '../componentes/Estados';
import { Icono, iconoDeCategoria } from './Iconos';
import { cargarCategorias } from './TiendaLayout';

export function Categorias() {
  const r = useApi(cargarCategorias, 'categorias');
  return (
    <main className="contenedor">
      <h1>Categorías</h1>
      {r.cargando && <EsqueletoFilas />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {r.datos && r.datos.length === 0 && <Vacio titulo="No hay categorías disponibles." />}
      <ul className="lista-categorias">
        {r.datos?.map((c) => (
          <li key={c.IDCategoria}>
            <Link to={`/buscar?idCategoria=${c.IDCategoria}`}>
              <span className="circulo-icono">
                <Icono nombre={iconoDeCategoria(c.Nombre)} />
              </span>
              <span>
                <strong>{c.Nombre}</strong>
                {c.Descripcion && <small>{c.Descripcion}</small>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
