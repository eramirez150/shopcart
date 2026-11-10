// Dashboard: indicadores, ventas por periodo, por categoría, productos más
// vendidos y carritos abandonados. Todo se calcula en la API con los filtros elegidos.
// Ventas netas = pedidos completados menos devoluciones; el ticket promedio usa los pedidos pagados.
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../api/cliente';
import type { Pagina } from '../api/tipos';
import { useApi } from '../api/useApi';
import { EsqueletoFilas, MensajeError, Vacio } from '../componentes/Estados';
import { Paginacion } from '../componentes/Paginacion';
import { useFiltros } from '../componentes/useFiltros';
import { fechaYHora, hoyISO, quetzales } from '../formato';
import { GraficaBarras } from './Grafica';

interface Indicadores {
  Pedidos: number;
  Ventas: number;
  PedidosPagados: number;
  MontoVendido: number;
  TicketPromedio: number;
  CarritosAbandonados: number;
}
interface VentaPeriodo {
  Periodo: string;
  Pedidos: number;
  Ventas: number;
}
interface VentaCategoria {
  IDCategoria: number;
  Categoria: string;
  Unidades: number;
  Ventas: number;
}
interface TopProducto {
  IDProducto: number;
  Producto: string;
  Unidades: number;
  Ventas: number;
}
interface CarritoAbandonado {
  IDCarrito: number;
  IDUsuario: number | null;
  Correo: string | null;
  FechaActualizacion: string;
  Lineas: number;
  Valor: number;
}

const entero = (n: number) => new Intl.NumberFormat('es-GT').format(n);
const quetzalesCortos = (n: number) => `Q${new Intl.NumberFormat('es-GT', { notation: 'compact' }).format(n)}`;

// La API devuelve el inicio de cada periodo a medianoche UTC.
function nombrePeriodo(iso: string, agrupacion: string): string {
  const d = new Date(iso);
  if (agrupacion === 'Mes') return d.toLocaleDateString('es-GT', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const dia = d.toLocaleDateString('es-GT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return agrupacion === 'Semana' ? `Sem. ${dia}` : dia;
}

function Tarjeta({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <div className="indicador">
      <p className="indicador-titulo">{titulo}</p>
      <p className="indicador-valor">{valor}</p>
      <p className="indicador-nota">{nota}</p>
    </div>
  );
}

// Cada gráfica tiene su tabla equivalente para leer los valores exactos.
function Bloque({ titulo, vacio, tabla, children }: { titulo: string; vacio: boolean; tabla?: ReactNode; children: ReactNode }) {
  return (
    <section className="bloque-grafica">
      <h2>{titulo}</h2>
      {vacio ? (
        <Vacio titulo="Sin ventas en este periodo." />
      ) : (
        <>
          {children}
          {tabla && (
            <details>
              <summary>Ver como tabla</summary>
              <div className="tabla-contenedor">{tabla}</div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function CarritosAbandonados({ horas }: { horas: string }) {
  const f = useFiltros({ pc: '1' }); // Página propia en la URL para no chocar con los filtros del dashboard.
  const pagina = Number(f.valores.pc) || 1;
  const r = useApi(() => api<Pagina<CarritoAbandonado>>('/admin/dashboard/carritos-abandonados', { consulta: { horas, pagina, tamano: 10 } }), `${horas}-${pagina}`);
  return (
    <section className="bloque-grafica">
      <h2>Carritos abandonados</h2>
      <p className="texto-suave">Abiertos, con productos y sin cambios en las últimas {horas} horas.</p>
      {r.cargando && <EsqueletoFilas />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {r.datos && r.datos.total === 0 && <Vacio titulo="No hay carritos abandonados." />}
      {r.datos && r.datos.total > 0 && (
        <>
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Carrito</th>
                  <th>Cliente</th>
                  <th>Última actividad</th>
                  <th className="num">Líneas</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {r.datos.datos.map((c) => (
                  <tr key={c.IDCarrito}>
                    <td data-etiqueta="Carrito">#{c.IDCarrito}</td>
                    <td data-etiqueta="Cliente">{c.Correo ?? 'Invitado'}</td>
                    <td data-etiqueta="Última actividad">{fechaYHora(c.FechaActualizacion)}</td>
                    <td data-etiqueta="Líneas" className="num">{c.Lineas}</td>
                    <td data-etiqueta="Valor" className="num">{quetzales(c.Valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion pagina={pagina} tamano={10} total={r.datos.total} cambiar={(n) => f.cambiar({ pc: String(n) })} />
        </>
      )}
    </section>
  );
}

export function Dashboard() {
  const f = useFiltros({ desde: hoyISO(-90), hasta: hoyISO(), agrupacion: 'Semana', horas: '24' });
  const v = f.valores;
  const rangoInvalido = v.desde > v.hasta;
  const rango = { desde: v.desde, hasta: v.hasta };
  const clave = `${v.desde}|${v.hasta}|${v.agrupacion}|${v.horas}`;

  const r = useApi(async () => {
    if (rangoInvalido) throw new Error('La fecha inicial no puede ser posterior a la final.');
    const [indicadores, ventas, categorias, top] = await Promise.all([
      api<Indicadores>('/admin/dashboard/indicadores', { consulta: { ...rango, horas: v.horas } }),
      api<VentaPeriodo[]>('/admin/dashboard/ventas', { consulta: { ...rango, agrupacion: v.agrupacion } }),
      api<VentaCategoria[]>('/admin/dashboard/categorias', { consulta: rango }),
      api<TopProducto[]>('/admin/dashboard/top-productos', { consulta: { ...rango, cantidad: 10 } }),
    ]);
    return { indicadores, ventas, categorias, top };
  }, clave);

  // Arreglos estables para que las gráficas no se redibujen en cada render.
  const series = useMemo(() => {
    const d = r.datos;
    if (!d) return null;
    return {
      periodos: d.ventas.map((x) => nombrePeriodo(x.Periodo, v.agrupacion)),
      ventas: d.ventas.map((x) => x.Ventas),
      pedidos: d.ventas.map((x) => x.Pedidos),
      categorias: d.categorias.map((x) => x.Categoria),
      ventasCategoria: d.categorias.map((x) => x.Ventas),
      productos: d.top.map((x) => x.Producto),
      unidades: d.top.map((x) => x.Unidades),
    };
  }, [r.datos, v.agrupacion]);

  const d = r.datos;
  return (
    <section>
      <h1>Dashboard</h1>
      <div className="filtros-panel">
        <div className="campo">
          <label htmlFor="desde">Desde</label>
          <input id="desde" type="date" value={v.desde} max={v.hasta} onChange={(e) => f.cambiar({ desde: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="hasta">Hasta</label>
          <input id="hasta" type="date" value={v.hasta} onChange={(e) => f.cambiar({ hasta: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="agrupacion">Agrupar por</label>
          <select id="agrupacion" value={v.agrupacion} onChange={(e) => f.cambiar({ agrupacion: e.target.value })}>
            <option value="Dia">Día</option>
            <option value="Semana">Semana</option>
            <option value="Mes">Mes</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="horas">Carrito abandonado tras</label>
          <select id="horas" value={v.horas} onChange={(e) => f.cambiar({ horas: e.target.value })}>
            <option value="1">1 hora</option>
            <option value="24">24 horas</option>
            <option value="72">3 días</option>
            <option value="168">7 días</option>
          </select>
        </div>
      </div>

      {r.cargando && <EsqueletoFilas />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {d && series && !r.cargando && (
        <>
          <div className="indicadores">
            <Tarjeta titulo="Ventas netas" valor={quetzales(d.indicadores.Ventas)} nota={`${entero(d.indicadores.Pedidos)} pedidos completados`} />
            <Tarjeta titulo="Ticket promedio" valor={quetzales(d.indicadores.TicketPromedio)} nota={`${quetzales(d.indicadores.MontoVendido)} en ${entero(d.indicadores.PedidosPagados)} pedidos pagados`} />
            <Tarjeta titulo="Carritos abandonados" valor={entero(d.indicadores.CarritosAbandonados)} nota={`Sin cambios en ${v.horas} h`} />
          </div>
          <p>
            <Link to={`/panel/pedidos?desde=${v.desde}&hasta=${v.hasta}`}>Ver los pedidos de este periodo</Link>
          </p>

          <div className="graficas">
            <Bloque
              titulo="Ventas netas por periodo (Q)"
              vacio={d.ventas.length === 0}
              tabla={
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Periodo</th>
                      <th className="num">Pedidos</th>
                      <th className="num">Ventas netas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.ventas.map((x, i) => (
                      <tr key={x.Periodo}>
                        <td data-etiqueta="Periodo">{series.periodos[i]}</td>
                        <td data-etiqueta="Pedidos" className="num">{x.Pedidos}</td>
                        <td data-etiqueta="Ventas netas" className="num">{quetzales(x.Ventas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <GraficaBarras etiquetas={series.periodos} valores={series.ventas} formato={quetzalesCortos} descripcion="Ventas netas en quetzales por periodo" />
            </Bloque>

            <Bloque titulo="Pedidos completados por periodo" vacio={d.ventas.length === 0}>
              <GraficaBarras etiquetas={series.periodos} valores={series.pedidos} formato={entero} descripcion="Número de pedidos completados por periodo" />
            </Bloque>

            <Bloque
              titulo="Ventas netas por categoría (Q)"
              vacio={d.categorias.length === 0}
              tabla={
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th className="num">Unidades</th>
                      <th className="num">Ventas netas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.categorias.map((x) => (
                      <tr key={x.IDCategoria}>
                        <td data-etiqueta="Categoría">{x.Categoria}</td>
                        <td data-etiqueta="Unidades" className="num">{x.Unidades}</td>
                        <td data-etiqueta="Ventas netas" className="num">{quetzales(x.Ventas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <GraficaBarras etiquetas={series.categorias} valores={series.ventasCategoria} formato={quetzalesCortos} horizontal descripcion="Ventas netas por categoría" />
            </Bloque>

            <Bloque
              titulo="10 productos más vendidos (unidades)"
              vacio={d.top.length === 0}
              tabla={
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="num">Unidades</th>
                      <th className="num">Ventas netas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.top.map((x) => (
                      <tr key={x.IDProducto}>
                        <td data-etiqueta="Producto">{x.Producto}</td>
                        <td data-etiqueta="Unidades" className="num">{x.Unidades}</td>
                        <td data-etiqueta="Ventas netas" className="num">{quetzales(x.Ventas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <GraficaBarras etiquetas={series.productos} valores={series.unidades} formato={entero} horizontal descripcion="Unidades netas vendidas de los 10 productos principales" />
            </Bloque>
          </div>
        </>
      )}
      {!rangoInvalido && <CarritosAbandonados horas={v.horas} />}
    </section>
  );
}
