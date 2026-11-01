// Direcciones de entrega del cliente: registrar, modificar y desactivar.
// No se borran porque los pedidos las referencian; los pedidos conservan el texto copiado.
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, ErrorApi, mensajeDe } from '../api/cliente';
import type { Direccion } from '../api/tipos';
import { useApi } from '../api/useApi';
import { CamposDireccion, validarDireccion, type DatosDireccion } from '../componentes/Direccion';
import { Aviso, EsqueletoFilas, MensajeError, Vacio } from '../componentes/Estados';

const VACIA: DatosDireccion = { direccion: '', ciudad: '', telefono: '' };

function Formulario({ inicial, idDireccion, terminar }: { inicial: DatosDireccion; idDireccion: number | null; terminar: (guardada: boolean) => void }) {
  const [datos, setDatos] = useState(inicial);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const encontrados = validarDireccion(datos);
    setErrores(encontrados ?? {});
    if (encontrados) return;
    setEnviando(true);
    setError('');
    try {
      const cuerpo = { direccion: datos.direccion.trim(), ciudad: datos.ciudad.trim(), telefono: datos.telefono.trim() };
      if (idDireccion) await api(`/direcciones/${idDireccion}`, { metodo: 'PUT', cuerpo });
      else await api('/direcciones', { metodo: 'POST', cuerpo });
      terminar(true);
    } catch (err) {
      if (err instanceof ErrorApi) setErrores(err.campos());
      setError(mensajeDe(err));
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta-formulario" onSubmit={guardar} noValidate>
      <h2>{idDireccion ? 'Modificar dirección' : 'Nueva dirección'}</h2>
      <CamposDireccion datos={datos} errores={errores} cambiar={setDatos} />
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="acciones">
        <button type="button" className="boton boton-secundario" disabled={enviando} onClick={() => terminar(false)}>
          Cancelar
        </button>
        <button type="submit" className="boton boton-principal" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

export function MisDirecciones() {
  const r = useApi(() => api<Direccion[]>('/direcciones'), 'direcciones');
  const [editando, setEditando] = useState<Direccion | 'nueva' | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [ocupada, setOcupada] = useState<number | null>(null);

  async function desactivar(d: Direccion) {
    if (!window.confirm(`¿Quitar la dirección "${d.Direccion}"?`)) return;
    setOcupada(d.IDDireccion);
    setAviso(null);
    try {
      await api(`/direcciones/${d.IDDireccion}`, { metodo: 'DELETE' });
      setAviso({ tipo: 'ok', texto: 'Dirección quitada.' });
      r.recargar();
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDe(e) });
    } finally {
      setOcupada(null);
    }
  }

  function terminar(guardada: boolean) {
    setEditando(null);
    if (guardada) {
      setAviso({ tipo: 'ok', texto: 'Dirección guardada.' });
      r.recargar();
    }
  }

  return (
    <main className="contenedor">
      <p>
        <Link to="/cuenta">Mi cuenta</Link>
      </p>
      <h1>Mis direcciones</h1>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      {editando ? (
        <Formulario
          inicial={editando === 'nueva' ? VACIA : { direccion: editando.Direccion, ciudad: editando.Ciudad, telefono: editando.Telefono }}
          idDireccion={editando === 'nueva' ? null : editando.IDDireccion}
          terminar={terminar}
        />
      ) : (
        <button type="button" className="boton boton-principal" onClick={() => setEditando('nueva')}>
          Agregar dirección
        </button>
      )}
      {r.cargando && !r.datos && <EsqueletoFilas />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {r.datos && r.datos.length === 0 && <Vacio titulo="No tienes direcciones guardadas." ilustracion="direcciones">Agrega una para pagar más rápido.</Vacio>}
      {r.datos && r.datos.length > 0 && (
        <ul className="lista-direcciones">
          {r.datos.map((d) => (
            <li key={d.IDDireccion}>
              <span>
                <strong>{d.Direccion}</strong>
                <small className="texto-suave">
                  {d.Ciudad} · {d.Telefono}
                </small>
              </span>
              <span className="acciones">
                <button type="button" className="boton-enlace" disabled={ocupada !== null} onClick={() => setEditando(d)}>
                  Modificar
                </button>
                <button type="button" className="boton-enlace" disabled={ocupada !== null} onClick={() => void desactivar(d)}>
                  {ocupada === d.IDDireccion ? 'Quitando…' : 'Quitar'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
