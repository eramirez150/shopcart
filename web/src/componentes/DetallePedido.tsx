// Datos de un pedido: líneas, totales, entrega, historial de estados y devoluciones.
// Lo usan Mi cuenta y el panel; cada uno agrega sus propias acciones.
import { api } from '../api/cliente';
import type { Devolucion, Pedido } from '../api/tipos';
import { fechaYHora, NOMBRE_ESTADO, quetzales } from '../formato';
import { Precio } from './Precio';

// La tienda pide sus pedidos en /cliente/pedidos y el panel en /admin/pedidos.
export const cargarPedido = async (base: string, id: string) => {
  const [pedido, devoluciones] = await Promise.all([api<Pedido>(`${base}/${id}`), api<Devolucion[]>(`${base}/${id}/devoluciones`)]);
  return { pedido, devoluciones };
};

export function DetallePedido({ pedido, devoluciones }: { pedido: Pedido; devoluciones: Devolucion[] | null }) {
  const skuDe = new Map(pedido.lineas.map((l) => [l.IDPedidoDetalle, l.Producto]));
  return (
    <div className="detalle-pedido">
      <dl className="datos">
        <div>
          <dt>Estado</dt>
          <dd>
            <strong>{NOMBRE_ESTADO[pedido.Estado]}</strong>
          </dd>
        </div>
        <div>
          <dt>Fecha</dt>
          <dd>{fechaYHora(pedido.FechaCreacion)}</dd>
        </div>
        <div>
          <dt>Cliente</dt>
          <dd>{pedido.Cliente}</dd>
        </div>
        <div>
          <dt>Entrega</dt>
          <dd>
            {pedido.Direccion}, {pedido.Ciudad} · {pedido.Telefono}
          </dd>
        </div>
        <div>
          <dt>Referencia de pago</dt>
          <dd className="texto-partido">{pedido.ReferenciaPago}</dd>
        </div>
      </dl>

      <h2>Productos</h2>
      <ul className="resumen-lineas lineas-pedido">
        {pedido.lineas.map((l) => (
          <li key={l.IDPedidoDetalle}>
            <span>
              <strong>{l.Producto}</strong>
              <small className="texto-suave">
                {l.SKU} · {l.Cantidad} × {quetzales(l.PrecioUnitario)}
                {l.Descuento > 0 && ` · descuento ${quetzales(l.Descuento)}`}
                {l.CantidadDevuelta > 0 && ` · ${l.CantidadDevuelta} devuelta${l.CantidadDevuelta === 1 ? '' : 's'}`}
              </small>
            </span>
            <Precio valor={Math.round((l.Cantidad * l.PrecioUnitario - l.Descuento) * 100) / 100} tamano="chico" />
          </li>
        ))}
      </ul>

      <dl className="totales totales-pedido">
        <div>
          <dt>Subtotal</dt>
          <dd>{quetzales(pedido.Subtotal)}</dd>
        </div>
        <div>
          <dt>Descuento{pedido.Cupon ? ` (${pedido.Cupon})` : ''}</dt>
          <dd>− {quetzales(pedido.Descuento)}</dd>
        </div>
        <div className="totales-total">
          <dt>Total</dt>
          <dd>
            <Precio valor={pedido.Total} tamano="grande" />
          </dd>
        </div>
        <p className="texto-suave">IVA incluido: {quetzales(pedido.IVA)}</p>
      </dl>

      <h2>Historial</h2>
      <ol className="historial">
        {pedido.historial.map((h, i) => (
          <li key={i}>
            <strong>{NOMBRE_ESTADO[h.EstadoNuevo]}</strong>
            <small className="texto-suave">
              {h.Fecha ? fechaYHora(h.Fecha) : ''} · {h.Usuario}
            </small>
            {h.Comentario && <span>{h.Comentario}</span>}
          </li>
        ))}
      </ol>

      {devoluciones && devoluciones.length > 0 && (
        <>
          <h2>Devoluciones</h2>
          <ul className="historial">
            {devoluciones.map((d) => (
              <li key={d.IDDevolucion}>
                <strong>
                  Devolución #{d.IDDevolucion} · {quetzales(d.Monto)}
                </strong>
                <small className="texto-suave">
                  {d.Fecha ? fechaYHora(d.Fecha) : ''} · {d.Motivo}
                </small>
                <span>{d.lineas.map((l) => `${l.Cantidad} × ${skuDe.get(l.IDPedidoDetalle) ?? l.SKU}`).join(', ')}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
