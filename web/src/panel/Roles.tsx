// Roles: fichas con cada rol, alta, modificación y desactivación con sus permisos por módulo.
// Administrador y Cliente son de sistema y solo se consultan. Un rol no se borra: se desactiva.
import { useState, type FormEvent } from 'react';
import { api, ErrorApi, mensajeDe } from '../api/cliente';
import type { Permiso, RolAdmin } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Campo } from '../componentes/Campo';
import { Aviso, EsqueletoFilas, MensajeError, Vacio } from '../componentes/Estados';
import { maximo, requerido, sinErrores } from '../validacion';

interface Modulo {
  clave: string;
  nombre: string;
  permisos: Permiso[];
}

const moduloDe = (codigo: string) => codigo.split('.', 1)[0] ?? codigo;
const esVer = (codigo: string) => codigo.endsWith('.ver');

// Agrupa por el prefijo del código; dentro de cada módulo, consultar va antes que gestionar.
// Los permisos no asignables (roles.gestionar) no se ofrecen.
// Display names for module codes stored without accents.
const NOMBRE_MODULO: Record<string, string> = { Bitacora: 'Bitácora', Catalogo: 'Catálogo' };

function agrupar(catalogo: Permiso[]): Modulo[] {
  const modulos = new Map<string, Modulo>();
  for (const p of catalogo) {
    if (!p.Asignable) continue;
    const clave = moduloDe(p.Codigo);
    const m = modulos.get(clave) ?? { clave, nombre: NOMBRE_MODULO[p.Modulo] ?? p.Modulo, permisos: [] };
    m.permisos.push(p);
    modulos.set(clave, m);
  }
  for (const m of modulos.values()) m.permisos.sort((a, b) => Number(esVer(b.Codigo)) - Number(esVer(a.Codigo)));
  return [...modulos.values()];
}

function Formulario({ rol, catalogo, terminar }: { rol: RolAdmin | null; catalogo: Permiso[]; terminar: (texto?: string) => void }) {
  const modulos = agrupar(catalogo);
  const asignables = new Set(modulos.flatMap((m) => m.permisos.map((p) => p.Codigo)));
  const [d, setD] = useState({ nombre: rol?.Nombre ?? '', descripcion: rol?.Descripcion ?? '' });
  const [elegidos, setElegidos] = useState(() => new Set(rol?.permisos ?? []));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Gestionar incluye consultar: al marcarlo se marca también el permiso de ver del módulo.
  const verIncluido = (codigo: string) => esVer(codigo) && elegidos.has(`${moduloDe(codigo)}.gestionar`);

  function alternar(codigo: string, marcado: boolean) {
    const s = new Set(elegidos);
    if (marcado) {
      s.add(codigo);
      const ver = `${moduloDe(codigo)}.ver`;
      if (codigo.endsWith('.gestionar') && asignables.has(ver)) s.add(ver);
    } else s.delete(codigo);
    setElegidos(s);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const encontrados = sinErrores({
      nombre: requerido(d.nombre, 'Escribe el nombre.') ?? maximo(d.nombre, 20),
      descripcion: maximo(d.descripcion, 200),
    });
    setErrores(encontrados ?? {});
    if (encontrados) return;
    setEnviando(true);
    setError('');
    const cuerpo = {
      nombre: d.nombre.trim(),
      descripcion: d.descripcion.trim() || null,
      permisos: [...elegidos].filter((c) => asignables.has(c)),
    };
    try {
      // PUT reemplaza el rol completo: se envía el estado actual para no reactivarlo sin querer.
      if (rol) await api(`/admin/roles/${rol.IDRol}`, { metodo: 'PUT', cuerpo: { ...cuerpo, activo: rol.Activo } });
      else await api('/admin/roles', { metodo: 'POST', cuerpo });
      terminar('Rol guardado.');
    } catch (err) {
      if (err instanceof ErrorApi) setErrores(err.campos());
      setError(mensajeDe(err));
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta-formulario formulario-ancho" onSubmit={guardar} noValidate>
      <h2>{rol ? `Modificar ${rol.Nombre}` : 'Nuevo rol'}</h2>
      <div className="rejilla-campos">
        <Campo etiqueta="Nombre" name="nombre" maxLength={20} value={d.nombre} error={errores.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
        <Campo etiqueta="Descripción" name="descripcion" maxLength={200} value={d.descripcion} error={errores.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} />
      </div>
      <fieldset className="permisos-rol">
        <legend>Permisos</legend>
        <div className="fichas-permisos">
          {modulos.map((m) => (
            <div key={m.clave} className="ficha-permiso">
              <h3>{m.nombre}</h3>
              {m.permisos.map((p) => (
                <label key={p.Codigo} className="casilla">
                  <input
                    type="checkbox"
                    checked={elegidos.has(p.Codigo) || verIncluido(p.Codigo)}
                    disabled={verIncluido(p.Codigo)}
                    onChange={(e) => alternar(p.Codigo, e.target.checked)}
                  />
                  {p.Descripcion}
                </label>
              ))}
            </div>
          ))}
        </div>
        {errores.permisos && <small className="campo-error">{errores.permisos}</small>}
      </fieldset>
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

export function Roles() {
  const r = useApi(() => api<RolAdmin[]>('/admin/roles'), 'roles');
  const catalogo = useApi(() => api<Permiso[]>('/admin/permisos'), 'permisos');
  const [editando, setEditando] = useState<RolAdmin | 'nuevo' | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  function terminar(texto?: string) {
    setEditando(null);
    if (texto) {
      setAviso({ tipo: 'ok', texto });
      r.recargar();
    }
  }

  async function cambiarEstado(rol: RolAdmin) {
    if (rol.Activo && !window.confirm(`¿Desactivar el rol ${rol.Nombre}?`)) return;
    setOcupado(rol.IDRol);
    setAviso(null);
    try {
      await api(`/admin/roles/${rol.IDRol}`, {
        metodo: 'PUT',
        cuerpo: { nombre: rol.Nombre, descripcion: rol.Descripcion, permisos: rol.permisos, activo: !rol.Activo },
      });
      setAviso({ tipo: 'ok', texto: rol.Activo ? `${rol.Nombre} desactivado.` : `${rol.Nombre} activado.` });
      r.recargar();
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDe(e) });
    } finally {
      setOcupado(null);
    }
  }

  const error = r.error ?? catalogo.error;

  return (
    <section>
      <div className="titulo-con-accion">
        <h1>Roles</h1>
        {!editando && catalogo.datos && (
          <button type="button" className="boton boton-principal" onClick={() => setEditando('nuevo')}>
            Nuevo rol
          </button>
        )}
      </div>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      {editando && catalogo.datos && (
        <Formulario key={editando === 'nuevo' ? 'nuevo' : editando.IDRol} rol={editando === 'nuevo' ? null : editando} catalogo={catalogo.datos} terminar={terminar} />
      )}
      {(r.cargando || catalogo.cargando) && !r.datos && <EsqueletoFilas filas={3} />}
      {error && (
        <MensajeError
          mensaje={error}
          reintentar={() => {
            r.recargar();
            catalogo.recargar();
          }}
        />
      )}
      {r.datos && r.datos.length === 0 && <Vacio titulo="No hay roles." />}
      {r.datos && r.datos.length > 0 && (
        <div className="fichas-roles">
          {r.datos.map((rol) => (
            <article key={rol.IDRol} className="ficha-rol">
              <h2>{rol.Nombre}</h2>
              <p className="texto-suave">{rol.Descripcion || 'Sin descripción.'}</p>
              <dl className="ficha-rol-datos">
                <div>
                  <dt>Estado</dt>
                  <dd>{rol.Activo ? 'Activo' : 'Inactivo'}</dd>
                </div>
                <div>
                  <dt>Usuarios activos</dt>
                  <dd>{rol.UsuariosActivos}</dd>
                </div>
                <div>
                  <dt>Permisos</dt>
                  <dd>{rol.permisos.length}</dd>
                </div>
              </dl>
              <div className="ficha-rol-acciones">
                {rol.EsSistema ? (
                  <span className="texto-suave">Rol de sistema</span>
                ) : (
                  <>
                    <button type="button" className="boton-enlace" disabled={ocupado !== null || !catalogo.datos} onClick={() => setEditando(rol)}>
                      Modificar
                    </button>
                    <button type="button" className="boton-enlace" disabled={ocupado !== null} onClick={() => void cambiarEstado(rol)}>
                      {rol.Activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
