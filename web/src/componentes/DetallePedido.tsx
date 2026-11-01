// Datos de un pedido: líneas, totales, entrega, historial de estados y devoluciones.
// Lo usan Mi cuenta y el panel; cada uno agrega sus propias acciones.
import type { Devolucion, Pedido } from '../api/tipos';
import { fechaYHora, NOMBRE_ESTADO, quetzales } from '../formato';

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
      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="num">Cantidad</th>
              <th className="num">Precio</th>
              <th className="num">Descuento</th>
              <th className="num">Devueltas</th>
            </tr>
          </thead>
          <tbody>
            {pedido.lineas.map((l) => (
              <tr key={l.IDPedidoDetalle}>
                <td>
                  {l.Producto}
                  <small className="texto-suave bloque">{l.SKU}</small>
                </td>
                <td className="num">{l.Cantidad}</td>
                <td className="num">{quetzales(l.PrecioUnitario)}</td>
                <td className="num">{quetzales(l.Descuento)}</td>
                <td className="num">{l.CantidadDevuelta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
          <dd>{quetzales(pedido.Total)}</dd>
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
