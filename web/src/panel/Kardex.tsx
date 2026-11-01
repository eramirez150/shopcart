// Kardex de una variante y registro de entradas, salidas y ajustes con motivo.
import { useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { api, mensajeDe } from '../api/cliente';
import type { MovimientoKardex, Pagina } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Aviso, EsqueletoFilas, MensajeError, Vacio } from '../componentes/Estados';
import { Paginacion } from '../componentes/Paginacion';
import { useFiltros } from '../componentes/useFiltros';
import { fechaYHora } from '../formato';
import { maximo, numero, requerido, sinErrores } from '../validacion';

const TAMANO = 20;
const NOMBRE_TIPO: Record<string, string> = { Entrada: 'Entrada', Salida: 'Salida', Ajuste: 'Ajuste', Devolucion: 'Devolución' };

function Movimiento({ idVariante, listo }: { idVariante: string; listo: () => void }) {
  const [datos, setDatos] = useState({ tipo: 'Entrada', cantidad: '', motivo: '' });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const ajuste = datos.tipo === 'Ajuste';
    const encontrados = sinErrores({
      cantidad:
        numero(datos.cantidad, { entero: true, nombre: 'La cantidad', ...(ajuste ? {} : { min: 1 }) }) ??
        (ajuste && Number(datos.cantidad) === 0 ? 'Un ajuste no puede ser 0.' : undefined),
      motivo: requerido(datos.motivo, 'Escribe el motivo.') ?? maximo(datos.motivo, 300),
    });
    setErrores(encontrados ?? {});
    if (encontrados) return;
    setEnviando(true);
    setAviso(null);
    try {
      await api('/inventario/movimientos', {
        metodo: 'POST',
        // Entrada y salida van en positivo (la API aplica el signo); el ajuste lleva signo.
        cuerpo: { idVariante: Number(idVariante), tipo: datos.tipo, cantidad: Number(datos.cantidad), motivo: datos.motivo.trim() },
      });
      setDatos({ ...datos, cantidad: '', motivo: '' });
      setAviso({ tipo: 'ok', texto: 'Movimiento registrado.' });
      listo();
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeDe(err) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta-formulario" onSubmit={enviar} noValidate>
      <h2>Registrar movimiento</h2>
      <div className="campo">
        <label htmlFor="tipo">Tipo</label>
        <select id="tipo" value={datos.tipo} onChange={(e) => setDatos({ ...datos, tipo: e.target.value })}>
          <option value="Entrada">Entrada</option>
          <option value="Salida">Salida</option>
          <option value="Ajuste">Ajuste</option>
        </select>
      </div>
      <div className="campo">
        <label htmlFor="cantidad">Cantidad</label>
        <input id="cantidad" type="number" value={datos.cantidad} aria-invalid={errores.cantidad ? true : undefined} onChange={(e) => setDatos({ ...datos, cantidad: e.target.value })} />
        {errores.cantidad ? (
          <small className="campo-error">{errores.cantidad}</small>
        ) : (
          <small className="campo-ayuda">{datos.tipo === 'Ajuste' ? 'Positiva suma y negativa resta.' : 'Número de unidades.'}</small>
        )}
      </div>
      <div className="campo">
        <label htmlFor="motivoMov">Motivo</label>
        <input id="motivoMov" value={datos.motivo} maxLength={300} aria-invalid={errores.motivo ? true : undefined} onChange={(e) => setDatos({ ...datos, motivo: e.target.value })} />
        {errores.motivo && <small className="campo-error">{errores.motivo}</small>}
      </div>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      <button type="submit" className="boton boton-principal" disabled={enviando}>
        {enviando ? 'Registrando…' : 'Registrar'}
      </button>
    </form>
  );
}

export function Kardex() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const f = useFiltros({ orden: 'recientes' });
  const r = useApi(() => api<Pagina<MovimientoKardex>>(`/inventario/variantes/${id}/kardex`, { consulta: { orden: f.valores.orden, pagina: f.pagina, tamano: TAMANO } }), `${id}?${f.clave}`);

  return (
    <section>
      <p>
        <Link to="/panel/inventario">Inventario</Link>
      </p>
      <h1>Kardex {params.get('sku') ?? `de la variante ${id}`}</h1>
      <div className="panel-dos-columnas">
        <div>
          <div className="barra-filtros">
            <label className="oculto-visual" htmlFor="ordenKardex">
              Orden
            </label>
            <select id="ordenKardex" className="control" value={f.valores.orden} onChange={(e) => f.cambiar({ orden: e.target.value })}>
              <option value="recientes">Más recientes</option>
              <option value="antiguos">Más antiguos</option>
            </select>
          </div>
          {r.cargando && <EsqueletoFilas />}
          {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
          {r.datos && r.datos.total === 0 && <Vacio titulo="Esta variante no tiene movimientos." />}
          {r.datos && r.datos.total > 0 && (
            <>
              <div className="tabla-contenedor">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th className="num">Cantidad</th>
                      <th className="num">Existencia</th>
                      <th>Motivo</th>
                      <th>Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.datos.datos.map((m) => (
                      <tr key={m.IDKardex}>
                        <td>{fechaYHora(m.Fecha)}</td>
                        <td>{NOMBRE_TIPO[m.Tipo] ?? m.Tipo}</td>
                        <td className="num">{m.Cantidad > 0 ? `+${m.Cantidad}` : m.Cantidad}</td>
                        <td className="num">{m.ExistenciaResultante}</td>
                        <td>
                          {m.Motivo}
                          {m.IDPedido && <small className="texto-suave bloque">Pedido #{m.IDPedido}</small>}
                        </td>
                        <td>{m.Usuario}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacion pagina={f.pagina} tamano={TAMANO} total={r.datos.total} cambiar={f.irAPagina} />
            </>
          )}
        </div>
        <Movimiento idVariante={id} listo={r.recargar} />
      </div>
    </section>
  );
}
