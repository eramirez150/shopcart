// Cupones: listado con orden y paginación, alta, modificación y desactivación.
// Los cupones no se borran porque los referencian carritos, reservas y pedidos.
import { useState, type FormEvent } from 'react';
import { api, ErrorApi, mensajeDe } from '../api/cliente';
import type { Cupon, Pagina } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Campo } from '../componentes/Campo';
import { Aviso, EsqueletoFilas, MensajeError, Vacio } from '../componentes/Estados';
import { Paginacion } from '../componentes/Paginacion';
import { useFiltros } from '../componentes/useFiltros';
import { fecha, quetzales } from '../formato';
import { maximo, numero, requerido, sinErrores } from '../validacion';
import { cargarTodasLasCategorias } from './Productos';

const TAMANO = 20;

// <input type="datetime-local"> trabaja en hora local sin zona; la API recibe ISO en UTC.
const aLocal = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const aISO = (local: string) => new Date(local).toISOString();

function Formulario({ cupon, terminar }: { cupon: Cupon | null; terminar: (texto?: string) => void }) {
  const categorias = useApi(cargarTodasLasCategorias, 'categorias-admin');
  const [d, setD] = useState({
    codigo: cupon?.Codigo ?? '',
    tipo: cupon?.Tipo ?? 'Porcentaje',
    valor: cupon ? String(cupon.Valor) : '',
    fechaInicio: cupon ? aLocal(cupon.FechaInicio) : '',
    fechaFin: cupon ? aLocal(cupon.FechaFin) : '',
    minimoCompra: cupon ? String(cupon.MinimoCompra) : '0',
    limiteTotal: cupon?.LimiteTotal != null ? String(cupon.LimiteTotal) : '',
    limitePorCliente: cupon?.LimitePorCliente != null ? String(cupon.LimitePorCliente) : '',
    idCategoria: cupon?.IDCategoria != null ? String(cupon.IDCategoria) : '',
    activo: cupon?.Activo ?? true,
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const limite = (v: string) => (v ? numero(v, { min: 1, entero: true, nombre: 'El límite' }) : undefined);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const encontrados = sinErrores({
      codigo: cupon ? undefined : (requerido(d.codigo, 'Escribe el código.') ?? maximo(d.codigo, 30)),
      valor:
        numero(d.valor, { min: 0.01, nombre: 'El valor' }) ?? (d.tipo === 'Porcentaje' && Number(d.valor) > 100 ? 'Un porcentaje no puede pasar de 100.' : undefined),
      fechaInicio: d.fechaInicio ? undefined : 'Elige la fecha de inicio.',
      fechaFin: !d.fechaFin ? 'Elige la fecha final.' : d.fechaInicio && d.fechaFin <= d.fechaInicio ? 'Debe ser posterior al inicio.' : undefined,
      minimoCompra: numero(d.minimoCompra, { min: 0, nombre: 'El mínimo' }),
      limiteTotal: limite(d.limiteTotal),
      limitePorCliente: limite(d.limitePorCliente),
    });
    setErrores(encontrados ?? {});
    if (encontrados) return;
    setEnviando(true);
    setError('');
    const cuerpo = {
      tipo: d.tipo,
      valor: Number(d.valor),
      fechaInicio: aISO(d.fechaInicio),
      fechaFin: aISO(d.fechaFin),
      minimoCompra: Number(d.minimoCompra),
      limiteTotal: d.limiteTotal ? Number(d.limiteTotal) : null,
      limitePorCliente: d.limitePorCliente ? Number(d.limitePorCliente) : null,
      idCategoria: d.idCategoria ? Number(d.idCategoria) : null,
    };
    try {
      if (cupon) await api(`/admin/cupones/${cupon.IDCupon}`, { metodo: 'PUT', cuerpo: { ...cuerpo, activo: d.activo } });
      else await api('/admin/cupones', { metodo: 'POST', cuerpo: { ...cuerpo, codigo: d.codigo.trim().toUpperCase() } });
      terminar('Cupón guardado.');
    } catch (err) {
      if (err instanceof ErrorApi) setErrores(err.campos());
      setError(mensajeDe(err));
      setEnviando(false);
    }
  }

  const campo = (nombre: keyof typeof d) => ({
    name: nombre,
    value: String(d[nombre]),
    error: errores[nombre],
    onChange: (e: { target: { value: string } }) => setD({ ...d, [nombre]: e.target.value }),
  });

  return (
    <form className="tarjeta-formulario formulario-ancho" onSubmit={guardar} noValidate>
      <h2>{cupon ? `Modificar ${cupon.Codigo}` : 'Nuevo cupón'}</h2>
      <div className="rejilla-campos">
        {!cupon && <Campo etiqueta="Código" {...campo('codigo')} />}
        <div className="campo">
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value as Cupon['Tipo'] })}>
            <option value="Porcentaje">Porcentaje</option>
            <option value="Monto">Monto fijo (Q)</option>
          </select>
        </div>
        <Campo etiqueta={d.tipo === 'Porcentaje' ? 'Valor (%)' : 'Valor (Q)'} inputMode="decimal" {...campo('valor')} />
        <Campo etiqueta="Inicio" type="datetime-local" {...campo('fechaInicio')} />
        <Campo etiqueta="Fin" type="datetime-local" {...campo('fechaFin')} />
        <Campo etiqueta="Compra mínima (Q)" inputMode="decimal" {...campo('minimoCompra')} />
        <Campo etiqueta="Límite total de usos" inputMode="numeric" ayuda="Vacío: sin límite." {...campo('limiteTotal')} />
        <Campo etiqueta="Límite por cliente" inputMode="numeric" ayuda="Vacío: sin límite." {...campo('limitePorCliente')} />
        <div className="campo">
          <label htmlFor="alcance">Alcance</label>
          <select id="alcance" value={d.idCategoria} onChange={(e) => setD({ ...d, idCategoria: e.target.value })}>
            <option value="">Todo el carrito</option>
            {/* Sin catalogo.gestionar no se listan las categorías: se conserva la del cupón. */}
            {!categorias.datos && d.idCategoria && <option value={d.idCategoria}>Categoría {d.idCategoria}</option>}
            {categorias.datos?.map((c) => (
              <option key={c.IDCategoria} value={c.IDCategoria}>
                Solo {c.Nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
      {cupon && (
        <label className="casilla">
          <input type="checkbox" checked={d.activo} onChange={(e) => setD({ ...d, activo: e.target.checked })} />
          Activo
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

export function Cupones() {
  const f = useFiltros({ orden: 'id' });
  const r = useApi(() => api<Pagina<Cupon>>('/admin/cupones', { consulta: { orden: f.valores.orden, pagina: f.pagina, tamano: TAMANO } }), f.clave);
  const categorias = useApi(cargarTodasLasCategorias, 'categorias-admin');
  const [editando, setEditando] = useState<Cupon | 'nuevo' | null>(null);
  const [aviso, setAviso] = useState('');
  const nombreCategoria = (id: number | null) => (id === null ? 'Carrito' : (categorias.datos?.find((c) => c.IDCategoria === id)?.Nombre ?? `Categoría ${id}`));

  function terminar(texto?: string) {
    setEditando(null);
    if (texto) {
      setAviso(texto);
      r.recargar();
    }
  }

  return (
    <section>
      <div className="titulo-con-accion">
        <h1>Cupones</h1>
        {!editando && (
          <button type="button" className="boton boton-principal" onClick={() => setEditando('nuevo')}>
            Nuevo cupón
          </button>
        )}
      </div>
      {aviso && <Aviso tipo="ok">{aviso}</Aviso>}
      {editando && <Formulario key={editando === 'nuevo' ? 'nuevo' : editando.IDCupon} cupon={editando === 'nuevo' ? null : editando} terminar={terminar} />}
      <div className="barra-filtros">
        <label className="oculto-visual" htmlFor="ordenCupones">
          Orden
        </label>
        <select id="ordenCupones" className="control" value={f.valores.orden} onChange={(e) => f.cambiar({ orden: e.target.value })}>
          <option value="id">Más antiguos primero</option>
          <option value="codigo">Código</option>
          <option value="vence">Vencen primero</option>
          <option value="usos">Más usados</option>
        </select>
      </div>
      {r.cargando && <EsqueletoFilas />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {r.datos && r.datos.total === 0 && <Vacio titulo="No hay cupones." />}
      {r.datos && r.datos.total > 0 && (
        <>
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descuento</th>
                  <th>Vigencia</th>
                  <th className="num">Mínimo</th>
                  <th className="num">Usos</th>
                  <th>Alcance</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {r.datos.datos.map((c) => (
                  <tr key={c.IDCupon}>
                    <td>{c.Codigo}</td>
                    <td>{c.Tipo === 'Porcentaje' ? `${c.Valor} %` : quetzales(c.Valor)}</td>
                    <td>
                      {fecha(c.FechaInicio)} a {fecha(c.FechaFin)}
                    </td>
                    <td className="num">{quetzales(c.MinimoCompra)}</td>
                    <td className="num">
                      {c.Usos}
                      {c.LimiteTotal != null && ` de ${c.LimiteTotal}`}
                    </td>
                    <td>{nombreCategoria(c.IDCategoria)}</td>
                    <td>{c.Activo ? 'Activo' : 'Inactivo'}</td>
                    <td>
                      <button type="button" className="boton-enlace" onClick={() => setEditando(c)}>
                        Modificar
                      </button>
                    </td>
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
