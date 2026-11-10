// Datos de un pedido: líneas, totales, entrega, envío, historial de estados y devoluciones.
// Lo usan Mi cuenta y el panel; cada uno agrega sus propias acciones.
import { api } from '../api/cliente';
import type { Devolucion, EnvioPedido, EstadoPedido, Pedido } from '../api/tipos';
import { fechaYHora, NOMBRE_ESTADO, quetzales } from '../formato';
import { Precio } from './Precio';

// La tienda pide sus pedidos en /cliente/pedidos y el panel en /admin/pedidos.
export const cargarPedido = async (base: string, id: string) => {
  const [pedido, devoluciones] = await Promise.all([api<Pedido>(`${base}/${id}`), api<Devolucion[]>(`${base}/${id}/devoluciones`)]);
  return { pedido, devoluciones };
};

const kilos = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 2 });

function DatosEnvio({ envio }: { envio: EnvioPedido }) {
  return (
    <>
      <h2>Envío</h2>
      <dl className="datos">
        <div>
          <dt>Mensajería</dt>
          <dd>{envio.Mensajeria}</dd>
        </div>
        <div>
          <dt>Guía</dt>
          <dd className="texto-partido">{envio.Guia}</dd>
        </div>
        <div>
          <dt>Peso</dt>
          <dd>{kilos.format(envio.PesoKg)} kg</dd>
        </div>
        {envio.CostoRecogida != null && (
          <div>
            <dt>Costo de recogida</dt>
            <dd>{quetzales(envio.CostoRecogida)}</dd>
          </div>
        )}
        <div>
          <dt>Despachado</dt>
          <dd>{fechaYHora(envio.FechaDespacho)}</dd>
        </div>
        {envio.FechaEntrega && (
          <div>
            <dt>Entregado</dt>
            <dd>
              {fechaYHora(envio.FechaEntrega)}
              {envio.RecibidoPor && ` · recibió ${envio.RecibidoPor}`}
            </dd>
          </div>
        )}
      </dl>
    </>
  );
}

// Avance del envío: pasos cumplidos, el actual resaltado y la fecha en que se alcanzó cada uno.
const PASOS: EstadoPedido[] = ['Pagado', 'EnPreparacion', 'Despachado', 'Entregado'];

function SeguimientoPedido({ pedido }: { pedido: Pedido }) {
  const actual = PASOS.indexOf(pedido.Estado);
  if (actual < 0) {
    return (
      <p className="seguimiento-cerrado">
        Estado del pedido: <strong>{NOMBRE_ESTADO[pedido.Estado]}</strong>
      </p>
    );
  }
  const fechaDe = (estado: EstadoPedido) => {
    const h = [...pedido.historial].reverse().find((x) => x.EstadoNuevo === estado);
    return h?.Fecha ?? (estado === 'Pagado' ? pedido.FechaCreacion : null);
  };
  return (
    <ol className="seguimiento" aria-label="Seguimiento del pedido">
      {PASOS.map((paso, i) => {
        const f = i <= actual ? fechaDe(paso) : null;
        return (
          <li key={paso} className={i < actual ? 'hecho' : i === actual ? 'actual' : undefined} aria-current={i === actual ? 'step' : undefined}>
            <strong>{NOMBRE_ESTADO[paso]}</strong>
            {f && <small className="texto-suave">{fechaYHora(f)}</small>}
            {paso === 'Despachado' && i <= actual && pedido.envio && (
              <small className="texto-suave texto-partido">
                {pedido.envio.Mensajeria} · {pedido.envio.Guia}
              </small>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function DetallePedido({ pedido, devoluciones }: { pedido: Pedido; devoluciones: Devolucion[] | null }) {
  const skuDe = new Map(pedido.lineas.map((l) => [l.IDPedidoDetalle, l.Producto]));
  return (
    <div className="detalle-pedido">
      <SeguimientoPedido pedido={pedido} />
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

      {pedido.envio && <DatosEnvio envio={pedido.envio} />}

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
