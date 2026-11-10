// Catálogo de administración: incluye productos inactivos y sin variantes.
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api } from '../api/cliente';
import type { Categoria, Pagina, ProductoAdministracion } from '../api/tipos';
import { useApi } from '../api/useApi';
import { EsqueletoFilas, MensajeError, Vacio } from '../componentes/Estados';
import { Paginacion } from '../componentes/Paginacion';
import { useFiltros } from '../componentes/useFiltros';
import { quetzales } from '../formato';

const TAMANO = 20;
export const cargarTodasLasCategorias = () => api<Categoria[]>('/admin/categorias', { consulta: { incluirInactivas: true } });

export function Productos() {
  const f = useFiltros({ texto: '', idCategoria: '', activo: '', orden: 'nombre' });
  const v = f.valores;
  const categorias = useApi(cargarTodasLasCategorias, 'categorias-admin');
  const r = useApi(() => api<Pagina<ProductoAdministracion>>('/admin/productos', { consulta: { ...v, pagina: f.pagina, tamano: TAMANO } }), f.clave);
  const [texto, setTexto] = useState(v.texto);

  function buscar(e: FormEvent) {
    e.preventDefault();
    f.cambiar({ texto: texto.trim() });
  }

  const precio = (p: ProductoAdministracion) =>
    p.PrecioDesde === null ? '—' : p.PrecioHasta !== null && p.PrecioHasta > p.PrecioDesde ? `${quetzales(p.PrecioDesde)} a ${quetzales(p.PrecioHasta)}` : quetzales(p.PrecioDesde);

  return (
    <section>
      <div className="titulo-con-accion">
        <h1>Productos</h1>
        <Link to="/panel/productos/nuevo" className="boton boton-principal">
          Nuevo producto
        </Link>
      </div>
      <form className="filtros-panel" onSubmit={buscar} noValidate>
        <div className="campo">
          <label htmlFor="texto">Buscar</label>
          <input id="texto" value={texto} maxLength={100} onChange={(e) => setTexto(e.target.value)} />
        </div>
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
        <div className="campo">
          <label htmlFor="activo">Estado</label>
          <select id="activo" value={v.activo} onChange={(e) => f.cambiar({ activo: e.target.value })}>
            <option value="">Activos e inactivos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="orden">Orden</label>
          <select id="orden" value={v.orden} onChange={(e) => f.cambiar({ orden: e.target.value })}>
            <option value="nombre">Nombre</option>
            <option value="recientes">Más recientes</option>
          </select>
        </div>
        <div className="filtros-panel-boton">
          <button type="submit" className="boton boton-secundario">
            Buscar
          </button>
        </div>
      </form>
      {r.cargando && <EsqueletoFilas />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {r.datos && r.datos.total === 0 && <Vacio titulo="No hay productos con esos filtros." />}
      {r.datos && r.datos.total > 0 && (
        <>
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th className="num">Variantes</th>
                  <th className="num">Precio</th>
                  <th className="num">Disponible</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {r.datos.datos.map((p) => (
                  <tr key={p.IDProducto}>
                    <td data-etiqueta="Producto">
                      <Link to={`/panel/productos/${p.IDProducto}`}>{p.Nombre}</Link>
                    </td>
                    <td data-etiqueta="Categoría">
                      {p.Categoria}
                      {!p.CategoriaActiva && <small className="texto-suave bloque">Categoría inactiva</small>}
                    </td>
                    <td data-etiqueta="Variantes" className="num">
                      {p.VariantesActivas} de {p.Variantes}
                    </td>
                    <td data-etiqueta="Precio" className="num">{precio(p)}</td>
                    <td data-etiqueta="Disponible" className="num">{p.Disponible}</td>
                    <td data-etiqueta="Estado">{p.Activo ? 'Activo' : 'Inactivo'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion pagina={f.pagina} tamano={TAMANO} total={r.datos.total} cambiar={f.irAPagina} />
        </>
      )}
    </section>
  );
}
