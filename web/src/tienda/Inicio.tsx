// Página de inicio: carrusel de promociones, categorías y secciones por tema.
// Todo sale de la API: las promociones invitan a recorrer las categorías reales.
import { Link } from 'react-router';
import { api, armarConsulta, type Consulta } from '../api/cliente';
import type { Categoria, Pagina, ProductoResumen } from '../api/tipos';
import { useApi } from '../api/useApi';
import { EsqueletoGrilla, MensajeError, Vacio } from '../componentes/Estados';
import { Silueta } from '../componentes/Ilustraciones';
import { Carrusel } from './Carrusel';
import { Icono, iconoDeCategoria } from './Iconos';
import { GrillaProductos } from './TarjetaProducto';
import { cargarCategorias } from './TiendaLayout';

export function buscarProductos(consulta: Consulta) {
  return api<Pagina<ProductoResumen>>('/publico/productos', { consulta });
}

function Promocion({ categoria, indice }: { categoria: Categoria; indice: number }) {
  return (
    <Link to={`/buscar?idCategoria=${categoria.IDCategoria}`} className={`promocion promocion-${indice % 3}`}>
      <div>
        <p className="promocion-antetitulo">Explora</p>
        <p className="promocion-titulo">{categoria.Nombre}</p>
        {categoria.Descripcion && <p className="promocion-texto">{categoria.Descripcion}</p>}
        <span className="promocion-boton">Ver productos</span>
      </div>
      <Silueta icono={iconoDeCategoria(categoria.Nombre)} />
    </Link>
  );
}

export function CirculosCategorias({ categorias }: { categorias: Categoria[] }) {
  return (
    <nav className="circulos" aria-label="Categorías">
      {categorias.map((c) => (
        <Link key={c.IDCategoria} to={`/buscar?idCategoria=${c.IDCategoria}`} className="circulo">
          <span className="circulo-icono">
            <Icono nombre={iconoDeCategoria(c.Nombre)} />
          </span>
          <span className="circulo-nombre">{c.Nombre}</span>
        </Link>
      ))}
    </nav>
  );
}

// Una sección con título, enlace Ver más y 6 productos (una pantalla de celular).
function Seccion({ titulo, consulta }: { titulo: string; consulta: Consulta }) {
  const filtro = armarConsulta(consulta);
  const r = useApi(() => buscarProductos({ ...consulta, tamano: 6 }), filtro);
  return (
    <section className="seccion">
      <div className="seccion-cabeza">
        <h2>{titulo}</h2>
        <Link to={`/buscar${filtro}`} className="ver-mas">
          Ver más <Icono nombre="flecha" />
        </Link>
      </div>
      {r.cargando && <EsqueletoGrilla />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {r.datos && r.datos.datos.length === 0 && <Vacio titulo="Todavía no hay productos en esta sección." />}
      {r.datos && r.datos.datos.length > 0 && <GrillaProductos productos={r.datos.datos} />}
    </section>
  );
}

export function Inicio() {
  const categorias = useApi(cargarCategorias, 'categorias');
  const lista = categorias.datos ?? [];
  return (
    <main className="inicio">
      {categorias.cargando && <div className="esqueleto esqueleto-carrusel" role="status" aria-label="Cargando" />}
      {categorias.error && <MensajeError mensaje={categorias.error} reintentar={categorias.recargar} />}
      {lista.length > 0 && (
        <>
          <Carrusel diapositivas={lista.slice(0, 4).map((c, i) => <Promocion key={c.IDCategoria} categoria={c} indice={i} />)} />
          <CirculosCategorias categorias={lista} />
        </>
      )}
      <div className="contenedor">
        <Seccion titulo="Novedades" consulta={{ orden: 'recientes', soloDisponibles: true }} />
        <Seccion titulo="Precios bajos" consulta={{ orden: 'precio_asc', soloDisponibles: true }} />
        {lista.slice(0, 2).map((c) => (
          <Seccion key={c.IDCategoria} titulo={c.Nombre} consulta={{ idCategoria: c.IDCategoria, soloDisponibles: true }} />
        ))}
      </div>
    </main>
  );
}
