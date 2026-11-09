// Pedido visto por el operador: cambio de estado (con datos de despacho y entrega) y devoluciones por línea.
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { api, ErrorApi, mensajeDe } from '../api/cliente';
import type { EstadoPedido, Pedido } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Campo } from '../componentes/Campo';
import { cargarPedido, DetallePedido } from '../componentes/DetallePedido';
import { Aviso, EsqueletoFilas, MensajeError } from '../componentes/Estados';
import { NOMBRE_ESTADO } from '../formato';
import { maximo, numero, requerido, sinErrores, tope } from '../validacion';

// Las mismas transiciones que dbo.PedidoTransiciones; la API las vuelve a validar.
const SIGUIENTES: Partial<Record<EstadoPedido, EstadoPedido[]>> = {
  Pagado: ['EnPreparacion', 'Cancelado'],
  EnPreparacion: ['Despachado', 'Cancelado'],
  Despachado: ['Entregado'],
};

type EstadoAviso = { tipo: 'ok' | 'error'; texto: string } | null;

const ENVIO_VACIO = { mensajeria: '', guia: '', pesoKg: '', costoRecogida: '', recibidoPor: '' };
type CampoEnvio = keyof typeof ENVIO_VACIO;

// Mismos límites que cambioEstadoAdmin en la API.
function validarEnvio(estado: string, d: typeof ENVIO_VACIO): Partial<Record<CampoEnvio, string | undefined>> {
  if (estado === 'Despachado') {
    return {
      mensajeria: requerido(d.mensajeria, 'Escribe la mensajería.') ?? maximo(d.mensajeria, 100),
      guia: requerido(d.guia, 'Escribe el número de guía.') ?? maximo(d.guia, 60),
      pesoKg: numero(d.pesoKg, { min: 0.01, nombre: 'El peso' }) ?? tope(d.pesoKg, 999999.99, 'El peso'),
      costoRecogida: numero(d.costoRecogida, { min: 0, nombre: 'El costo' }) ?? tope(d.costoRecogida, 9999999999.99, 'El costo'),
    };
  }
  if (estado === 'Entregado') return { recibidoPor: requerido(d.recibidoPor, 'Escribe quién recibió.') ?? maximo(d.recibidoPor, 150) };
  return {};
}

function cuerpoEnvio(estado: string, d: typeof ENVIO_VACIO) {
  if (estado === 'Despachado') {
    return { mensajeria: d.mensajeria.trim(), guia: d.guia.trim(), pesoKg: Number(d.pesoKg), costoRecogida: Number(d.costoRecogida) };
  }
  if (estado === 'Entregado') return { recibidoPor: d.recibidoPor.trim() };
  return {};
}

function CambioEstado({ pedido, listo }: { pedido: Pedido; listo: (texto: string) => void }) {
  const opciones = SIGUIENTES[pedido.Estado] ?? [];
  const [estado, setEstado] = useState(opciones[0] ?? '');
  const [comentario, setComentario] = useState('');
  const [envio, setEnvio] = useState(ENVIO_VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  if (opciones.length === 0) return null;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const encontrados = sinErrores({ ...validarEnvio(estado, envio), comentario: maximo(comentario, 300) });
    setErrores(encontrados ?? {});
    setError('');
    if (encontrados) return;
    setEnviando(true);
    try {
      await api(`/admin/pedidos/${pedido.IDPedido}/estado`, {
        metodo: 'PATCH',
        cuerpo: { estado, comentario: comentario.trim() || null, ...cuerpoEnvio(estado, envio) },
      });
      setComentario('');
      setEnvio(ENVIO_VACIO);
      listo(`El pedido pasó a ${NOMBRE_ESTADO[estado as EstadoPedido]}.`);
    } catch (err) {
      if (err instanceof ErrorApi) setErrores(err.campos());
      setError(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  }

  const campo = (nombre: CampoEnvio) => ({
    id: nombre,
    value: envio[nombre],
    error: errores[nombre],
    onChange: (e: { target: { value: string } }) => setEnvio({ ...envio, [nombre]: e.target.value }),
  });

  return (
    <form className="tarjeta-formulario" onSubmit={enviar} noValidate>
      <h2>Cambiar estado</h2>
      <div className="campo">
        <label htmlFor="nuevoEstado">Nuevo estado</label>
        <select id="nuevoEstado" value={estado} onChange={(e) => setEstado(e.target.value as EstadoPedido)}>
          {opciones.map((o) => (
            <option key={o} value={o}>
              {NOMBRE_ESTADO[o]}
            </option>
          ))}
        </select>
      </div>
      {estado === 'Despachado' && (
        <>
          <div className="fila-campos">
            <Campo etiqueta="Mensajería" maxLength={100} {...campo('mensajeria')} />
            <Campo etiqueta="Guía" maxLength={60} {...campo('guia')} />
          </div>
          <div className="fila-campos">
            <Campo etiqueta="Peso (kg)" inputMode="decimal" {...campo('pesoKg')} />
            <Campo etiqueta="Costo de recogida (Q)" inputMode="decimal" {...campo('costoRecogida')} />
          </div>
        </>
      )}
      {estado === 'Entregado' && <Campo etiqueta="Recibido por" maxLength={150} {...campo('recibidoPor')} />}
      <Campo
        etiqueta="Comentario (opcional)"
        id="comentario"
        value={comentario}
        maxLength={300}
        error={errores.comentario}
        onChange={(e) => setComentario(e.target.value)}
      />
      {error && <Aviso tipo="error">{error}</Aviso>}
      <button type="submit" className="boton boton-principal" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar estado'}
      </button>
    </form>
  );
}

function FormularioDevolucion({ pedido, listo }: { pedido: Pedido; listo: (texto: string) => void }) {
  const lineas = pedido.lineas.filter((l) => l.Cantidad > l.CantidadDevuelta);
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  if (!['Entregado', 'DevueltoParcial'].includes(pedido.Estado) || lineas.length === 0) return null;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const nuevos: Record<string, string> = {};
    const elegidas: { idPedidoDetalle: number; cantidad: number }[] = [];
    for (const l of lineas) {
      const texto = cantidades[l.IDPedidoDetalle] ?? '';
      if (!texto) continue;
      const n = Number(texto);
      const pendiente = l.Cantidad - l.CantidadDevuelta;
      if (!Number.isInteger(n) || n < 0 || n > pendiente) nuevos[l.IDPedidoDetalle] = `Entre 0 y ${pendiente}.`;
      else if (n > 0) elegidas.push({ idPedidoDetalle: l.IDPedidoDetalle, cantidad: n });
    }
    const errMotivo = requerido(motivo, 'Escribe el motivo de la devolución.') ?? maximo(motivo, 300);
    if (errMotivo) nuevos.motivo = errMotivo;
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;
    if (elegidas.length === 0) return setError('Indica al menos una cantidad a devolver.');
    setEnviando(true);
    setError('');
    try {
      await api(`/admin/pedidos/${pedido.IDPedido}/devoluciones`, { metodo: 'POST', cuerpo: { motivo: motivo.trim(), lineas: elegidas } });
      setCantidades({});
      setMotivo('');
      listo('Devolución registrada; la existencia se reintegró por kardex.');
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta-formulario" onSubmit={enviar} noValidate>
      <h2>Registrar devolución</h2>
      <p className="texto-suave">Indica cuántas unidades se devuelven de cada línea. Deja en blanco las que no cambian.</p>
      {lineas.map((l) => (
        <div className="campo campo-linea" key={l.IDPedidoDetalle}>
          <label htmlFor={`dev-${l.IDPedidoDetalle}`}>
            {l.Producto} <small className="texto-suave">(pendiente {l.Cantidad - l.CantidadDevuelta})</small>
          </label>
          <input
            id={`dev-${l.IDPedidoDetalle}`}
            type="number"
            min={0}
            max={l.Cantidad - l.CantidadDevuelta}
            value={cantidades[l.IDPedidoDetalle] ?? ''}
            aria-invalid={errores[l.IDPedidoDetalle] ? true : undefined}
            onChange={(e) => setCantidades({ ...cantidades, [l.IDPedidoDetalle]: e.target.value })}
          />
          {errores[l.IDPedidoDetalle] && <small className="campo-error">{errores[l.IDPedidoDetalle]}</small>}
        </div>
      ))}
      <div className="campo">
        <label htmlFor="motivo">Motivo</label>
        <input id="motivo" value={motivo} maxLength={300} aria-invalid={errores.motivo ? true : undefined} onChange={(e) => setMotivo(e.target.value)} />
        {errores.motivo && <small className="campo-error">{errores.motivo}</small>}
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <button type="submit" className="boton boton-principal" disabled={enviando}>
        {enviando ? 'Registrando…' : 'Registrar devolución'}
      </button>
    </form>
  );
}

export function PedidoPanel() {
  const { id = '' } = useParams();
  const r = useApi(() => cargarPedido('/admin/pedidos', id), id);
  const [aviso, setAviso] = useState<EstadoAviso>(null);

  function listo(texto: string) {
    setAviso({ tipo: 'ok', texto });
    r.recargar();
  }

  return (
    <section>
      <p>
        <Link to="/panel/pedidos">Pedidos</Link>
      </p>
      <h1>Pedido #{id}</h1>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      {r.cargando && !r.datos && <EsqueletoFilas />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {r.datos && (
        <div className="panel-dos-columnas">
          <DetallePedido pedido={r.datos.pedido} devoluciones={r.datos.devoluciones} />
          <div>
            <CambioEstado key={`e${r.datos.pedido.Estado}`} pedido={r.datos.pedido} listo={listo} />
            <FormularioDevolucion key={`d${r.datos.devoluciones.length}`} pedido={r.datos.pedido} listo={listo} />
          </div>
        </div>
      )}
    </section>
  );
}
