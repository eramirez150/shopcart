// Categorías: crear, modificar, activar o desactivar y eliminar.
// Eliminar una categoría con productos la desactiva (lo decide la API).
import { useState, type FormEvent } from 'react';
import { api, ErrorApi, mensajeDe } from '../api/cliente';
import type { Categoria } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Campo } from '../componentes/Campo';
import { Aviso, EsqueletoFilas, MensajeError, Vacio } from '../componentes/Estados';
import { maximo, requerido, sinErrores } from '../validacion';

function Formulario({ categoria, terminar }: { categoria: Categoria | null; terminar: (texto?: string) => void }) {
  const [datos, setDatos] = useState({ nombre: categoria?.Nombre ?? '', descripcion: categoria?.Descripcion ?? '', activa: categoria?.Activa ?? true });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const encontrados = sinErrores({ nombre: requerido(datos.nombre, 'Escribe el nombre.') ?? maximo(datos.nombre, 80), descripcion: maximo(datos.descripcion, 300) });
    setErrores(encontrados ?? {});
    if (encontrados) return;
    setEnviando(true);
    setError('');
    const cuerpo = { nombre: datos.nombre.trim(), descripcion: datos.descripcion.trim() || null };
    try {
      if (categoria) await api(`/admin/categorias/${categoria.IDCategoria}`, { metodo: 'PUT', cuerpo: { ...cuerpo, activa: datos.activa } });
      else await api('/admin/categorias', { metodo: 'POST', cuerpo });
      terminar('Categoría guardada.');
    } catch (err) {
      if (err instanceof ErrorApi) setErrores(err.campos());
      setError(mensajeDe(err));
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta-formulario" onSubmit={guardar} noValidate>
      <h2>{categoria ? `Modificar ${categoria.Nombre}` : 'Nueva categoría'}</h2>
      <Campo etiqueta="Nombre" name="nombre" value={datos.nombre} error={errores.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
      <Campo etiqueta="Descripción" name="descripcion" value={datos.descripcion} error={errores.descripcion} onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} />
      {categoria && (
        <label className="casilla">
          <input type="checkbox" checked={datos.activa} onChange={(e) => setDatos({ ...datos, activa: e.target.checked })} />
          Activa
        </label>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="acciones">
        <button type="button" className="boton boton-secundario" disabled={enviando} onClick={() => terminar()}>
          Cancelar
        </button>
        <button type="submit" className="boton boton-principal" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

export function CategoriasPanel() {
  const r = useApi(() => api<Categoria[]>('/admin/categorias', { consulta: { incluirInactivas: true } }), 'categorias-admin');
  const [editando, setEditando] = useState<Categoria | 'nueva' | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  function terminar(texto?: string) {
    setEditando(null);
    if (texto) {
      setAviso({ tipo: 'ok', texto });
      r.recargar();
    }
  }

  async function eliminar(c: Categoria) {
    if (!window.confirm(`¿Eliminar la categoría ${c.Nombre}? Si tiene productos solo se desactivará.`)) return;
    try {
      const res = await api<{ Resultado: string }>(`/admin/categorias/${c.IDCategoria}`, { metodo: 'DELETE' });
      setAviso({ tipo: 'ok', texto: res.Resultado === 'Desactivada' ? 'La categoría tiene productos: se desactivó.' : 'Categoría eliminada.' });
      r.recargar();
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDe(e) });
    }
  }

  return (
    <section>
      <h1>Categorías</h1>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      {editando ? (
        <Formulario key={editando === 'nueva' ? 'nueva' : editando.IDCategoria} categoria={editando === 'nueva' ? null : editando} terminar={terminar} />
      ) : (
        <button type="button" className="boton boton-principal" onClick={() => setEditando('nueva')}>
          Nueva categoría
        </button>
      )}
      {r.cargando && !r.datos && <EsqueletoFilas />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {r.datos && r.datos.length === 0 && <Vacio titulo="No hay categorías." />}
      {r.datos && r.datos.length > 0 && (
        <div className="tabla-contenedor separado">
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {r.datos.map((c) => (
                <tr key={c.IDCategoria}>
                  <td data-etiqueta="Nombre">{c.Nombre}</td>
                  <td data-etiqueta="Descripción">{c.Descripcion}</td>
                  <td data-etiqueta="Estado">{c.Activa ? 'Activa' : 'Inactiva'}</td>
                  <td className="celda-acciones">
                    <button type="button" className="boton-enlace" onClick={() => setEditando(c)}>
                      Modificar
                    </button>
                    <button type="button" className="boton-enlace" onClick={() => void eliminar(c)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
