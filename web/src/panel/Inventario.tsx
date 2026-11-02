// Existencias por variante: existencia física, reservado y disponible, con umbral, orden y paginación.
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api } from '../api/cliente';
import type { Existencia, Pagina } from '../api/tipos';
import { useApi } from '../api/useApi';
import { EsqueletoFilas, MensajeError, Vacio } from '../componentes/Estados';
import { Paginacion } from '../componentes/Paginacion';
import { useFiltros } from '../componentes/useFiltros';
import { textoAtributos } from '../formato';
import { numero } from '../validacion';

const TAMANO = 20;

export function Inventario() {
  const f = useFiltros({ umbral: '', orden: 'disponible' });
  const r = useApi(() => api<Pagina<Existencia>>('/admin/inventario/existencias', { consulta: { ...f.valores, pagina: f.pagina, tamano: TAMANO } }), f.clave);
  const [umbral, setUmbral] = useState(f.valores.umbral);
  const [error, setError] = useState('');

  function aplicar(e: FormEvent) {
    e.preventDefault();
    const err = umbral ? numero(umbral, { min: 0, entero: true, nombre: 'El umbral' }) : undefined;
    setError(err ?? '');
    if (!err) f.cambiar({ umbral });
  }

  return (
    <section>
      <h1>Inventario</h1>
      <form className="filtros-panel" onSubmit={aplicar} noValidate>
        <div className="campo">
          <label htmlFor="umbral">Disponible igual o menor a</label>
          <input id="umbral" inputMode="numeric" value={umbral} onChange={(e) => setUmbral(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="orden">Orden</label>
          <select id="orden" value={f.valores.orden} onChange={(e) => f.cambiar({ orden: e.target.value })}>
            <option value="disponible">Menor disponible</option>
            <option value="disponible_desc">Mayor disponible</option>
            <option value="sku">SKU</option>
            <option value="producto">Producto</option>
          </select>
        </div>
        <div className="filtros-panel-boton">
          <button type="submit" className="boton boton-secundario">
            Aplicar
          </button>
        </div>
        {error && <p className="campo-error filtros-panel-error">{error}</p>}
      </form>
      {r.cargando && <EsqueletoFilas />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {r.datos && r.datos.total === 0 && <Vacio titulo="No hay variantes con ese filtro." />}
      {r.datos && r.datos.total > 0 && (
        <>
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Producto</th>
                  <th className="num">Existencia</th>
                  <th className="num">Reservado</th>
                  <th className="num">Disponible</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {r.datos.datos.map((x) => (
                  <tr key={x.IDVariante}>
                    <td>{x.SKU}</td>
                    <td>
                      {x.Producto} <small className="texto-suave">{textoAtributos(x.Atributos)}</small>
                    </td>
                    <td className="num">{x.Existencia}</td>
                    <td className="num">{x.Reservado}</td>
                    <td className="num">
                      <strong>{x.Disponible}</strong>
                    </td>
                    <td>
                      <Link to={`/panel/inventario/${x.IDVariante}?sku=${encodeURIComponent(x.SKU)}`}>Kardex y movimientos</Link>
                    </td>
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
