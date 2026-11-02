// Pedidos del cliente con filtro por estado, orden y paginación en el servidor.
import { Link } from 'react-router';
import { api } from '../api/cliente';
import { ESTADOS_PEDIDO, type Pagina, type PedidoResumen } from '../api/tipos';
import { useApi } from '../api/useApi';
import { EsqueletoFilas, MensajeError, Vacio } from '../componentes/Estados';
import { Paginacion } from '../componentes/Paginacion';
import { useFiltros } from '../componentes/useFiltros';
import { fecha, NOMBRE_ESTADO, quetzales } from '../formato';

const TAMANO = 10;

export function MisPedidos() {
  const f = useFiltros({ estado: '', orden: 'recientes' });
  const r = useApi(() => api<Pagina<PedidoResumen>>('/cliente/pedidos', { consulta: { ...f.valores, pagina: f.pagina, tamano: TAMANO } }), f.clave);
  return (
    <main className="contenedor">
      <p>
        <Link to="/cuenta">Mi cuenta</Link>
      </p>
      <h1>Mis pedidos</h1>
      <div className="barra-filtros">
        <label className="oculto-visual" htmlFor="estado">
          Estado
        </label>
        <select id="estado" className="control" value={f.valores.estado} onChange={(e) => f.cambiar({ estado: e.target.value })}>
          <option value="">Todos los estados</option>
          {ESTADOS_PEDIDO.map((e) => (
            <option key={e} value={e}>
              {NOMBRE_ESTADO[e]}
            </option>
          ))}
        </select>
        <label className="oculto-visual" htmlFor="orden">
          Ordenar por
        </label>
        <select id="orden" className="control" value={f.valores.orden} onChange={(e) => f.cambiar({ orden: e.target.value })}>
          <option value="recientes">Más recientes</option>
          <option value="antiguos">Más antiguos</option>
          <option value="total_desc">Mayor total</option>
          <option value="total_asc">Menor total</option>
        </select>
      </div>
      {r.cargando && <EsqueletoFilas />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {r.datos && r.datos.total === 0 && (
        <Vacio titulo={f.valores.estado ? 'No tienes pedidos con ese estado.' : 'Todavía no tienes pedidos.'} ilustracion="pedidos">
          <Link to="/" className="boton boton-principal">
            Ir a la tienda
          </Link>
        </Vacio>
      )}
      {r.datos && r.datos.total > 0 && (
        <>
          <ul className="lista-pedidos">
            {r.datos.datos.map((p) => (
              <li key={p.IDPedido}>
                <Link to={`/cuenta/pedidos/${p.IDPedido}`}>
                  <span>
                    <strong>Pedido #{p.IDPedido}</strong>
                    <small className="texto-suave">{fecha(p.FechaCreacion)}</small>
                  </span>
                  <span className="lista-pedidos-derecha">
                    <strong>{quetzales(p.Total)}</strong>
                    <small>{NOMBRE_ESTADO[p.Estado]}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Paginacion pagina={f.pagina} tamano={TAMANO} total={r.datos.total} cambiar={f.irAPagina} />
        </>
      )}
    </main>
  );
}
