// Detalle de un pedido propio con su historial; se puede cancelar antes del despacho.
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, mensajeDe } from '../api/cliente';
import type { Devolucion, Pedido } from '../api/tipos';
import { useApi } from '../api/useApi';
import { DetallePedido } from '../componentes/DetallePedido';
import { Aviso, EsqueletoFilas, MensajeError } from '../componentes/Estados';

export const cargarPedido = async (id: string) => {
  const [pedido, devoluciones] = await Promise.all([api<Pedido>(`/pedidos/${id}`), api<Devolucion[]>(`/pedidos/${id}/devoluciones`)]);
  return { pedido, devoluciones };
};

export function MiPedido() {
  const { id = '' } = useParams();
  const r = useApi(() => cargarPedido(id), id);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  async function cancelar() {
    if (enviando) return;
    setEnviando(true);
    setAviso(null);
    try {
      await api(`/pedidos/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado: 'Cancelado', comentario: 'Cancelado por el cliente' } });
      setAviso({ tipo: 'ok', texto: 'El pedido se canceló.' });
      setConfirmando(false);
      r.recargar();
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDe(e) });
    } finally {
      setEnviando(false);
    }
  }

  const cancelable = r.datos && (r.datos.pedido.Estado === 'Pagado' || r.datos.pedido.Estado === 'EnPreparacion');

  return (
    <main className="contenedor">
      <p>
        <Link to="/cuenta/pedidos">Mis pedidos</Link>
      </p>
      <h1>Pedido #{id}</h1>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      {r.cargando && !r.datos && <EsqueletoFilas />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {r.datos && (
        <>
          <DetallePedido pedido={r.datos.pedido} devoluciones={r.datos.devoluciones} />
          {cancelable && !confirmando && (
            <button type="button" className="boton boton-peligro" onClick={() => setConfirmando(true)}>
              Cancelar pedido
            </button>
          )}
          {cancelable && confirmando && (
            <div className="confirmar">
              <p>¿Seguro que quieres cancelar este pedido? Se devolverá la existencia y el uso del cupón.</p>
              <div className="acciones">
                <button type="button" className="boton boton-secundario" disabled={enviando} onClick={() => setConfirmando(false)}>
                  No, conservarlo
                </button>
                <button type="button" className="boton boton-peligro" disabled={enviando} onClick={() => void cancelar()}>
                  {enviando ? 'Cancelando…' : 'Sí, cancelar'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
