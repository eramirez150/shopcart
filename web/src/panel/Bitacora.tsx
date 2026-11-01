// Bitácora (Administrador): solo lectura, con filtro por módulo y fechas, orden y paginación.
import { api } from '../api/cliente';
import type { Pagina, RegistroBitacora } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Cargando, MensajeError, Vacio } from '../componentes/Estados';
import { Paginacion } from '../componentes/Paginacion';
import { useFiltros } from '../componentes/useFiltros';
import { fechaYHora } from '../formato';

const TAMANO = 25;
const MODULOS = [
  { valor: 'Catalogo', texto: 'Catálogo' },
  { valor: 'Inventario', texto: 'Inventario' },
  { valor: 'Cupones', texto: 'Cupones' },
  { valor: 'Pedidos', texto: 'Pedidos' },
];

// '{"Precio":349}' -> "Precio: 349"
function legible(json: string | null): string {
  if (!json) return '—';
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    return Object.entries(o)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(', ');
  } catch {
    return json;
  }
}

export function Bitacora() {
  const f = useFiltros({ modulo: '', desde: '', hasta: '', orden: 'recientes' });
  const v = f.valores;
  const r = useApi(() => api<Pagina<RegistroBitacora>>('/bitacora', { consulta: { ...v, pagina: f.pagina, tamano: TAMANO } }), f.clave);
  const rangoInvalido = Boolean(v.desde && v.hasta && v.desde > v.hasta);

  return (
    <section>
      <h1>Bitácora</h1>
      <div className="filtros-panel">
        <div className="campo">
          <label htmlFor="modulo">Módulo</label>
          <select id="modulo" value={v.modulo} onChange={(e) => f.cambiar({ modulo: e.target.value })}>
            <option value="">Todos</option>
            {MODULOS.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.texto}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="desde">Desde</label>
          <input id="desde" type="date" value={v.desde} onChange={(e) => f.cambiar({ desde: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="hasta">Hasta</label>
          <input id="hasta" type="date" value={v.hasta} onChange={(e) => f.cambiar({ hasta: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="orden">Orden</label>
          <select id="orden" value={v.orden} onChange={(e) => f.cambiar({ orden: e.target.value })}>
            <option value="recientes">Más recientes</option>
            <option value="antiguos">Más antiguos</option>
          </select>
        </div>
        {rangoInvalido && <p className="campo-error filtros-panel-error">La fecha inicial no puede ser posterior a la final.</p>}
      </div>
      {r.cargando && <Cargando />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {r.datos && r.datos.total === 0 && <Vacio titulo="No hay registros con esos filtros." />}
      {r.datos && r.datos.total > 0 && (
        <>
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Módulo</th>
                  <th>Entidad</th>
                  <th>Acción</th>
                  <th>Antes</th>
                  <th>Después</th>
                </tr>
              </thead>
              <tbody>
                {r.datos.datos.map((b) => (
                  <tr key={b.IDBitacora}>
                    <td className="sin-salto">{fechaYHora(b.Fecha)}</td>
                    <td>{b.Usuario ?? 'Sistema'}</td>
                    <td>{MODULOS.find((m) => m.valor === b.Modulo)?.texto ?? b.Modulo}</td>
                    <td>
                      {b.Entidad} #{b.IDEntidad}
                    </td>
                    <td>{b.Accion}</td>
                    <td className="celda-json">{legible(b.ValorAnterior)}</td>
                    <td className="celda-json">{legible(b.ValorNuevo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion pagina={f.pagina} tamano={TAMANO} total={r.datos.total} cambiar={f.irAPagina} />
        </>
      )}
    </section>
  );
}
