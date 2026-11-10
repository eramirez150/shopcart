// Usuarios: listado por rol, alta con rol, cambio de rol y desactivación.
// Un usuario nunca se borra; desactivarlo cierra sus sesiones.
import { useState, type FormEvent } from 'react';
import { api, ErrorApi, mensajeDe } from '../api/cliente';
import type { Pagina, Rol, RolAdmin, UsuarioAdmin } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Campo } from '../componentes/Campo';
import { Aviso, EsqueletoFilas, MensajeError, Vacio } from '../componentes/Estados';
import { Paginacion } from '../componentes/Paginacion';
import { useFiltros } from '../componentes/useFiltros';
import { useSesion } from '../sesion/SesionContexto';
import { claveNueva, correo, maximo, requerido, sinErrores } from '../validacion';

const TAMANO = 20;
const ROLES_BASE: Rol[] = ['Cliente', 'Operador', 'Administrador'];

// Solo roles.gestionar puede listar los roles; sin ese permiso quedan los de la semilla.
function useRoles(): Rol[] {
  const r = useApi(() => api<RolAdmin[]>('/admin/roles'), 'roles');
  return r.datos?.filter((x) => x.Activo).map((x) => x.Nombre) ?? ROLES_BASE;
}

function NuevoUsuario({ roles, terminar }: { roles: Rol[]; terminar: (texto?: string) => void }) {
  const [d, setD] = useState({ nombre: '', correo: '', clave: '', rol: 'Operador' as Rol });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const encontrados = sinErrores({
      nombre: requerido(d.nombre, 'Escribe el nombre.') ?? maximo(d.nombre, 100),
      correo: correo(d.correo),
      clave: claveNueva(d.clave),
    });
    setErrores(encontrados ?? {});
    if (encontrados) return;
    setEnviando(true);
    setError('');
    try {
      await api('/admin/usuarios', { metodo: 'POST', cuerpo: { ...d, nombre: d.nombre.trim(), correo: d.correo.trim() } });
      terminar('Usuario creado.');
    } catch (err) {
      if (err instanceof ErrorApi) setErrores(err.campos());
      setError(mensajeDe(err));
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta-formulario" onSubmit={guardar} noValidate>
      <h2>Nuevo usuario</h2>
      <Campo etiqueta="Nombre" name="nombre" value={d.nombre} error={errores.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
      <Campo etiqueta="Correo" name="correo" type="email" value={d.correo} error={errores.correo} onChange={(e) => setD({ ...d, correo: e.target.value })} />
      <Campo etiqueta="Contraseña inicial" name="clave" type="password" autoComplete="new-password" value={d.clave} error={errores.clave} onChange={(e) => setD({ ...d, clave: e.target.value })} />
      <div className="campo">
        <label htmlFor="rolNuevo">Rol</label>
        <select id="rolNuevo" value={d.rol} onChange={(e) => setD({ ...d, rol: e.target.value as Rol })}>
          {roles.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="acciones">
        <button type="button" className="boton boton-secundario" disabled={enviando} onClick={() => terminar()}>
          Cancelar
        </button>
        <button type="submit" className="boton boton-principal" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear usuario'}
        </button>
      </div>
    </form>
  );
}

export function Usuarios() {
  const { usuario } = useSesion();
  const f = useFiltros({ rol: '', orden: 'id' });
  const roles = useRoles();
  const r = useApi(() => api<Pagina<UsuarioAdmin>>('/admin/usuarios', { consulta: { ...f.valores, pagina: f.pagina, tamano: TAMANO } }), f.clave);
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  async function actualizar(u: UsuarioAdmin, cambio: { rol?: Rol; activo?: boolean }) {
    if (cambio.activo === false && !window.confirm(`¿Desactivar a ${u.Nombre}? Se cerrarán sus sesiones.`)) return;
    setOcupado(u.IDUsuario);
    setAviso(null);
    try {
      await api(`/admin/usuarios/${u.IDUsuario}`, { metodo: 'PATCH', cuerpo: cambio });
      setAviso({ tipo: 'ok', texto: `${u.Nombre} actualizado.` });
      r.recargar();
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDe(e) });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section>
      <div className="titulo-con-accion">
        <h1>Usuarios</h1>
        {!creando && (
          <button type="button" className="boton boton-principal" onClick={() => setCreando(true)}>
            Nuevo usuario
          </button>
        )}
      </div>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      {creando && (
        <NuevoUsuario
          roles={roles}
          terminar={(texto) => {
            setCreando(false);
            if (texto) {
              setAviso({ tipo: 'ok', texto });
              r.recargar();
            }
          }}
        />
      )}
      <div className="barra-filtros">
        <label className="oculto-visual" htmlFor="rol">
          Rol
        </label>
        <select id="rol" className="control" value={f.valores.rol} onChange={(e) => f.cambiar({ rol: e.target.value })}>
          <option value="">Todos los roles</option>
          {roles.map((r2) => (
            <option key={r2}>{r2}</option>
          ))}
        </select>
        <label className="oculto-visual" htmlFor="ordenUsuarios">
          Orden
        </label>
        <select id="ordenUsuarios" className="control" value={f.valores.orden} onChange={(e) => f.cambiar({ orden: e.target.value })}>
          <option value="id">ID</option>
          <option value="nombre">Nombre</option>
          <option value="correo">Correo</option>
          <option value="recientes">Más recientes</option>
        </select>
      </div>
      {r.cargando && <EsqueletoFilas />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {r.datos && r.datos.total === 0 && <Vacio titulo="No hay usuarios con ese rol." />}
      {r.datos && r.datos.total > 0 && (
        <>
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {r.datos.datos.map((u) => {
                  const yo = u.IDUsuario === usuario?.id;
                  return (
                    <tr key={u.IDUsuario}>
                      <td data-etiqueta="Nombre">{u.Nombre}</td>
                      <td data-etiqueta="Correo">{u.Correo}</td>
                      <td data-etiqueta="Rol">
                        <label className="oculto-visual" htmlFor={`rol-${u.IDUsuario}`}>
                          Rol de {u.Nombre}
                        </label>
                        <select id={`rol-${u.IDUsuario}`} className="control control-chico" value={u.Rol} disabled={yo || ocupado !== null} onChange={(e) => void actualizar(u, { rol: e.target.value as Rol })}>
                          {[...new Set([...roles, u.Rol])].map((r2) => (
                            <option key={r2}>{r2}</option>
                          ))}
                        </select>
                      </td>
                      <td data-etiqueta="Estado">{u.Activo ? 'Activo' : 'Inactivo'}</td>
                      <td>
                        {!yo && (
                          <button type="button" className="boton-enlace" disabled={ocupado !== null} onClick={() => void actualizar(u, { activo: !u.Activo })}>
                            {u.Activo ? 'Desactivar' : 'Activar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginacion pagina={f.pagina} tamano={TAMANO} total={r.datos.total} cambiar={f.irAPagina} />
        </>
      )}
    </section>
  );
}
