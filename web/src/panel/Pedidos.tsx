// Pedidos para operador y administrador: filtros, orden y paginación en el servidor.
// También es el "listado filtrado de pedidos" del dashboard.
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api } from '../api/cliente';
import { ESTADOS_PEDIDO, type Pagina, type PedidoResumen } from '../api/tipos';
import { useApi } from '../api/useApi';
import { EsqueletoFilas, MensajeError, Vacio } from '../componentes/Estados';
import { Paginacion } from '../componentes/Paginacion';
import { useFiltros } from '../componentes/useFiltros';
import { fecha, NOMBRE_ESTADO, quetzales } from '../formato';
import { numero } from '../validacion';

const TAMANO = 20;

export function Pedidos() {
  const f = useFiltros({ estado: '', desde: '', hasta: '', idCliente: '', totalMin: '', totalMax: '', orden: 'recientes' });
  const v = f.valores;
  const r = useApi(() => api<Pagina<PedidoResumen>>('/pedidos', { consulta: { ...v, pagina: f.pagina, tamano: TAMANO } }), f.clave);
  const [montos, setMontos] = useState({ idCliente: v.idCliente, totalMin: v.totalMin, totalMax: v.totalMax });
  const [error, setError] = useState('');

  function aplicar(e: FormEvent) {
    e.preventDefault();
    const err =
      (montos.idCliente && numero(montos.idCliente, { min: 1, entero: true, nombre: 'El cliente' })) ||
      (montos.totalMin && numero(montos.totalMin, { min: 0, nombre: 'El total mínimo' })) ||
      (montos.totalMax && numero(montos.totalMax, { min: 0, nombre: 'El total máximo' })) ||
      (v.desde && v.hasta && v.desde > v.hasta ? 'La fecha inicial no puede ser posterior a la final.' : '');
    setError(err || '');
    if (!err) f.cambiar(montos);
  }

  return (
    <section>
      <h1>Pedidos</h1>
      <form className="filtros-panel" onSubmit={aplicar} noValidate>
        <div className="campo">
          <label htmlFor="estado">Estado</label>
          <select id="estado" value={v.estado} onChange={(e) => f.cambiar({ estado: e.target.value })}>
            <option value="">Todos</option>
            {ESTADOS_PEDIDO.map((e) => (
              <option key={e} value={e}>
                {NOMBRE_ESTADO[e]}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="desde">Desde</label>
          <input id="desde" type="date" value={v.desde} onChange={(e) => f.cambiar({ desde: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="hasta">Hasta</label>
          <input id="hasta" type="date" value={v.hasta} onChange={(e) => f.cambiar({ hasta: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="orden">Orden</label>
          <select id="orden" value={v.orden} onChange={(e) => f.cambiar({ orden: e.target.value })}>
            <option value="recientes">Más recientes</option>
            <option value="antiguos">Más antiguos</option>
            <option value="total_desc">Mayor total</option>
            <option value="total_asc">Menor total</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="idCliente">ID de cliente</label>
          <input id="idCliente" inputMode="numeric" value={montos.idCliente} onChange={(e) => setMontos({ ...montos, idCliente: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="totalMin">Total mínimo</label>
          <input id="totalMin" inputMode="decimal" value={montos.totalMin} onChange={(e) => setMontos({ ...montos, totalMin: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="totalMax">Total máximo</label>
          <input id="totalMax" inputMode="decimal" value={montos.totalMax} onChange={(e) => setMontos({ ...montos, totalMax: e.target.value })} />
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
      {r.datos && r.datos.total === 0 && <Vacio titulo="No hay pedidos con esos filtros." ilustracion="pedidos" />}
      {r.datos && r.datos.total > 0 && (
        <>
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {r.datos.datos.map((p) => (
                  <tr key={p.IDPedido}>
                    <td>
                      <Link to={`/panel/pedidos/${p.IDPedido}`}>#{p.IDPedido}</Link>
                    </td>
                    <td>{fecha(p.FechaCreacion)}</td>
                    <td>
                      {p.Cliente} <small className="texto-suave">(ID {p.IDUsuario})</small>
                    </td>
                    <td>{NOMBRE_ESTADO[p.Estado]}</td>
                    <td className="num">{quetzales(p.Total)}</td>
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
