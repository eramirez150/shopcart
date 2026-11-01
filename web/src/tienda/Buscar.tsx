// Listado de productos con búsqueda, filtros, orden y paginación hechos en el servidor.
// Es el destino de "Ver más", de las categorías y del buscador.
import { useState, type FormEvent } from 'react';
import { useApi } from '../api/useApi';
import { EsqueletoGrilla, MensajeError, Vacio } from '../componentes/Estados';
import { Paginacion } from '../componentes/Paginacion';
import { useFiltros } from '../componentes/useFiltros';
import { numero } from '../validacion';
import { buscarProductos } from './Inicio';
import { GrillaProductos } from './TarjetaProducto';
import { cargarCategorias } from './TiendaLayout';

const TAMANO = 24;

const ORDENES = [
  { valor: 'nombre', texto: 'Nombre' },
  { valor: 'recientes', texto: 'Más recientes' },
  { valor: 'precio_asc', texto: 'Precio: menor a mayor' },
  { valor: 'precio_desc', texto: 'Precio: mayor a menor' },
];

export function Buscar() {
  const f = useFiltros({ texto: '', idCategoria: '', precioMin: '', precioMax: '', soloDisponibles: '', orden: 'nombre' });
  const v = f.valores;
  const categorias = useApi(cargarCategorias, 'categorias');
  const r = useApi(() => buscarProductos({ ...v, pagina: f.pagina, tamano: TAMANO }), f.clave);
  const [verFiltros, setVerFiltros] = useState(false);
  const [precios, setPrecios] = useState({ min: v.precioMin, max: v.precioMax });
  const [errorPrecio, setErrorPrecio] = useState('');

  const categoria = categorias.datos?.find((c) => String(c.IDCategoria) === v.idCategoria);
  const titulo = v.texto ? `Resultados para "${v.texto}"` : (categoria?.Nombre ?? 'Todos los productos');

  function aplicarPrecios(e: FormEvent) {
    e.preventDefault();
    const err =
      (precios.min && numero(precios.min, { min: 0, nombre: 'El precio mínimo' })) ||
      (precios.max && numero(precios.max, { min: 0, nombre: 'El precio máximo' })) ||
      (precios.min && precios.max && Number(precios.min) > Number(precios.max) ? 'El mínimo no puede ser mayor que el máximo.' : '');
    setErrorPrecio(err || '');
    if (!err) f.cambiar({ precioMin: precios.min, precioMax: precios.max });
  }

  return (
    <main className="contenedor">
      <h1>{titulo}</h1>
      <div className="barra-filtros">
        <label className="oculto-visual" htmlFor="orden">
          Ordenar por
        </label>
        <select id="orden" className="control" value={v.orden} onChange={(e) => f.cambiar({ orden: e.target.value })}>
          {ORDENES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
        <button type="button" className="boton boton-secundario" aria-expanded={verFiltros} onClick={() => setVerFiltros(!verFiltros)}>
          Filtros
        </button>
      </div>

      {verFiltros && (
        <form className="filtros" onSubmit={aplicarPrecios} noValidate>
          <div className="campo">
            <label htmlFor="idCategoria">Categoría</label>
            <select id="idCategoria" value={v.idCategoria} onChange={(e) => f.cambiar({ idCategoria: e.target.value })}>
              <option value="">Todas</option>
              {categorias.datos?.map((c) => (
                <option key={c.IDCategoria} value={c.IDCategoria}>
                  {c.Nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="precioMin">Precio mínimo</label>
              <input id="precioMin" inputMode="decimal" value={precios.min} onChange={(e) => setPrecios({ ...precios, min: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="precioMax">Precio máximo</label>
              <input id="precioMax" inputMode="decimal" value={precios.max} onChange={(e) => setPrecios({ ...precios, max: e.target.value })} />
            </div>
          </div>
          {errorPrecio && <p className="campo-error">{errorPrecio}</p>}
          <label className="casilla">
            <input type="checkbox" checked={v.soloDisponibles === 'true'} onChange={(e) => f.cambiar({ soloDisponibles: e.target.checked ? 'true' : '' })} />
            Solo con existencia
          </label>
          <button type="submit" className="boton boton-principal">
            Aplicar precios
          </button>
        </form>
      )}

      {r.cargando && <EsqueletoGrilla />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {r.datos && r.datos.total === 0 && <Vacio titulo="No encontramos productos con esos filtros." ilustracion="busqueda">Prueba con otra palabra o quita algún filtro.</Vacio>}
      {r.datos && r.datos.total > 0 && (
        <>
          <GrillaProductos productos={r.datos.datos} />
          <Paginacion pagina={f.pagina} tamano={TAMANO} total={r.datos.total} cambiar={f.irAPagina} />
        </>
      )}
    </main>
  );
}
