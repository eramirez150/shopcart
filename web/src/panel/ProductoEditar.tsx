// Edición de un producto (Administrador): datos, variantes con SKU, atributos y precio, e imágenes.
// Cada escritura responde con el producto completo, que reemplaza al que se muestra.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, ErrorApi, mensajeDe } from '../api/cliente';
import type { Atributos, Producto, Variante } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Campo } from '../componentes/Campo';
import { Aviso, EsqueletoFilas, MensajeError, Vacio } from '../componentes/Estados';
import { quetzales, textoAtributos } from '../formato';
import { maximo, numero, requerido, sinErrores } from '../validacion';
import { cargarTodasLasCategorias } from './Productos';

type Avisar = (tipo: 'ok' | 'error', texto: string) => void;

// "Color: Negro" en cada línea <-> { Color: 'Negro' }
const atributosATexto = (a: Atributos) =>
  Object.entries(a)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

function textoAAtributos(texto: string): Atributos | string {
  const r: Atributos = {};
  for (const linea of texto.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const i = linea.indexOf(':');
    const clave = linea.slice(0, i).trim();
    const valor = linea.slice(i + 1).trim();
    if (i < 1 || !clave || !valor) return `Escribe cada atributo como "Nombre: valor" (revisa "${linea}").`;
    r[clave] = valor;
  }
  return r;
}

function DatosProducto({ producto, guardado }: { producto: Producto | null; guardado: (p: Producto) => void }) {
  const categorias = useApi(cargarTodasLasCategorias, 'categorias-admin');
  const [datos, setDatos] = useState({
    idCategoria: producto ? String(producto.IDCategoria) : '',
    nombre: producto?.Nombre ?? '',
    descripcion: producto?.Descripcion ?? '',
    activo: producto?.Activo ?? true,
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const encontrados = sinErrores({
      idCategoria: datos.idCategoria ? undefined : 'Elige una categoría.',
      nombre: requerido(datos.nombre, 'Escribe el nombre.') ?? maximo(datos.nombre, 150),
      descripcion: maximo(datos.descripcion, 1000),
    });
    setErrores(encontrados ?? {});
    if (encontrados) return;
    setEnviando(true);
    setAviso(null);
    const cuerpo = { idCategoria: Number(datos.idCategoria), nombre: datos.nombre.trim(), descripcion: datos.descripcion.trim() || null };
    try {
      const p = producto
        ? await api<Producto>(`/productos/${producto.IDProducto}`, { metodo: 'PUT', cuerpo: { ...cuerpo, activo: datos.activo } })
        : await api<Producto>('/productos', { metodo: 'POST', cuerpo });
      setAviso({ tipo: 'ok', texto: 'Producto guardado.' });
      guardado(p);
    } catch (err) {
      if (err instanceof ErrorApi) setErrores(err.campos());
      setAviso({ tipo: 'error', texto: mensajeDe(err) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta-formulario" onSubmit={guardar} noValidate>
      <h2>Datos del producto</h2>
      <div className="campo">
        <label htmlFor="categoria">Categoría</label>
        <select id="categoria" value={datos.idCategoria} aria-invalid={errores.idCategoria ? true : undefined} onChange={(e) => setDatos({ ...datos, idCategoria: e.target.value })}>
          <option value="">Elige una categoría</option>
          {categorias.datos?.map((c) => (
            <option key={c.IDCategoria} value={c.IDCategoria}>
              {c.Nombre}
              {c.Activa ? '' : ' (inactiva)'}
            </option>
          ))}
        </select>
        {errores.idCategoria && <small className="campo-error">{errores.idCategoria}</small>}
      </div>
      <Campo etiqueta="Nombre" name="nombre" value={datos.nombre} error={errores.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
      <div className="campo">
        <label htmlFor="descripcion">Descripción</label>
        <textarea id="descripcion" value={datos.descripcion} maxLength={1000} onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} />
        {errores.descripcion && <small className="campo-error">{errores.descripcion}</small>}
      </div>
      {producto && (
        <label className="casilla">
          <input type="checkbox" checked={datos.activo} onChange={(e) => setDatos({ ...datos, activo: e.target.checked })} />
          Activo (visible en la tienda)
        </label>
      )}
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      <button type="submit" className="boton boton-principal" disabled={enviando}>
        {enviando ? 'Guardando…' : producto ? 'Guardar cambios' : 'Crear producto'}
      </button>
    </form>
  );
}

function FormularioVariante({ idProducto, variante, terminar, avisar }: { idProducto: number; variante: Variante | null; terminar: (p?: Producto) => void; avisar: Avisar }) {
  const [datos, setDatos] = useState({
    sku: variante?.SKU ?? '',
    atributos: variante ? atributosATexto(variante.Atributos) : '',
    precio: variante ? String(variante.Precio) : '',
    existencia: '0',
    activa: variante?.Activa ?? true,
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const atributos = textoAAtributos(datos.atributos);
    const encontrados = sinErrores({
      sku: requerido(datos.sku, 'Escribe el SKU.') ?? maximo(datos.sku, 40),
      atributos: typeof atributos === 'string' ? atributos : undefined,
      precio: numero(datos.precio, { min: 0, nombre: 'El precio' }),
      existencia: variante ? undefined : numero(datos.existencia, { min: 0, entero: true, nombre: 'La existencia' }),
    });
    setErrores(encontrados ?? {});
    if (encontrados || typeof atributos === 'string') return;
    setEnviando(true);
    const cuerpo = { sku: datos.sku.trim(), atributos, precio: Number(datos.precio) };
    try {
      const p = variante
        ? await api<Producto>(`/productos/variantes/${variante.IDVariante}`, { metodo: 'PUT', cuerpo: { ...cuerpo, activa: datos.activa } })
        : await api<Producto>(`/productos/${idProducto}/variantes`, { metodo: 'POST', cuerpo: { ...cuerpo, existenciaInicial: Number(datos.existencia) } });
      avisar('ok', variante ? 'Variante actualizada.' : 'Variante creada.');
      terminar(p);
    } catch (err) {
      if (err instanceof ErrorApi) setErrores(err.campos());
      avisar('error', mensajeDe(err));
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta-formulario" onSubmit={guardar} noValidate>
      <h3>{variante ? `Modificar ${variante.SKU}` : 'Nueva variante'}</h3>
      <Campo etiqueta="SKU" name="sku" value={datos.sku} error={errores.sku} onChange={(e) => setDatos({ ...datos, sku: e.target.value })} />
      <div className="campo">
        <label htmlFor="atributos">Atributos</label>
        <textarea id="atributos" placeholder={'Color: Negro\nTalla: M'} value={datos.atributos} onChange={(e) => setDatos({ ...datos, atributos: e.target.value })} />
        {errores.atributos ? <small className="campo-error">{errores.atributos}</small> : <small className="campo-ayuda">Uno por línea, como "Nombre: valor". Puede quedar vacío.</small>}
      </div>
      <Campo etiqueta="Precio (Q, con IVA)" name="precio" inputMode="decimal" value={datos.precio} error={errores.precio} onChange={(e) => setDatos({ ...datos, precio: e.target.value })} />
      {!variante && (
        <Campo
          etiqueta="Existencia inicial"
          name="existencia"
          inputMode="numeric"
          value={datos.existencia}
          error={errores.existencia}
          ayuda="Se registra como entrada en el kardex."
          onChange={(e) => setDatos({ ...datos, existencia: e.target.value })}
        />
      )}
      {variante && (
        <label className="casilla">
          <input type="checkbox" checked={datos.activa} onChange={(e) => setDatos({ ...datos, activa: e.target.checked })} />
          Activa
        </label>
      )}
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

function Variantes({ producto, cambiar, avisar }: { producto: Producto; cambiar: (p: Producto) => void; avisar: Avisar }) {
  const [editando, setEditando] = useState<Variante | 'nueva' | null>(null);
  function terminar(p?: Producto) {
    setEditando(null);
    if (p) cambiar(p);
  }
  return (
    <section className="seccion">
      <div className="titulo-con-accion">
        <h2>Variantes y precios</h2>
        {!editando && (
          <button type="button" className="boton boton-secundario" onClick={() => setEditando('nueva')}>
            Agregar variante
          </button>
        )}
      </div>
      {editando && (
        <FormularioVariante key={editando === 'nueva' ? 'nueva' : editando.IDVariante} idProducto={producto.IDProducto} variante={editando === 'nueva' ? null : editando} terminar={terminar} avisar={avisar} />
      )}
      {producto.variantes.length === 0 ? (
        <Vacio titulo="Este producto no tiene variantes; no aparece en la tienda hasta tener una activa." />
      ) : (
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Atributos</th>
                <th className="num">Precio</th>
                <th className="num">Existencia</th>
                <th className="num">Disponible</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {producto.variantes.map((v) => (
                <tr key={v.IDVariante}>
                  <td>{v.SKU}</td>
                  <td>{textoAtributos(v.Atributos) || '—'}</td>
                  <td className="num">{quetzales(v.Precio)}</td>
                  <td className="num">{v.Existencia}</td>
                  <td className="num">{v.Disponible}</td>
                  <td>{v.Activa ? 'Activa' : 'Inactiva'}</td>
                  <td className="celda-acciones">
                    <button type="button" className="boton-enlace" onClick={() => setEditando(v)}>
                      Modificar
                    </button>
                    <Link to={`/panel/inventario/${v.IDVariante}?sku=${encodeURIComponent(v.SKU)}`}>Kardex</Link>
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

function Imagenes({ producto, cambiar, avisar }: { producto: Producto; cambiar: (p: Producto) => void; avisar: Avisar }) {
  const [datos, setDatos] = useState({ url: '', texto: '', orden: String(producto.imagenes.length) });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const encontrados = sinErrores({
      url: requerido(datos.url, 'Escribe la URL de la imagen.') ?? (/^https?:\/\/\S+$/.test(datos.url.trim()) ? maximo(datos.url, 500) : 'La URL debe empezar con http:// o https://.'),
      texto: maximo(datos.texto, 150),
      orden: numero(datos.orden, { min: 0, entero: true, nombre: 'El orden' }),
    });
    setErrores(encontrados ?? {});
    if (encontrados) return;
    setEnviando(true);
    try {
      const p = await api<Producto>(`/productos/${producto.IDProducto}/imagenes`, {
        metodo: 'POST',
        cuerpo: { url: datos.url.trim(), textoAlternativo: datos.texto.trim() || null, orden: Number(datos.orden) },
      });
      setDatos({ url: '', texto: '', orden: String(p.imagenes.length) });
      avisar('ok', 'Imagen agregada.');
      cambiar(p);
    } catch (err) {
      avisar('error', mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  }

  async function quitar(idImagen: number) {
    if (!window.confirm('¿Quitar esta imagen?')) return;
    try {
      cambiar(await api<Producto>(`/productos/imagenes/${idImagen}`, { metodo: 'DELETE' }));
      avisar('ok', 'Imagen quitada.');
    } catch (err) {
      avisar('error', mensajeDe(err));
    }
  }

  const imagenes = [...producto.imagenes].sort((a, b) => a.Orden - b.Orden);
  return (
    <section className="seccion">
      <h2>Imágenes</h2>
      <p className="texto-suave">La de menor orden es la principal.</p>
      {imagenes.length === 0 && <Vacio titulo="Sin imágenes." />}
      <ul className="imagenes-admin">
        {imagenes.map((img) => (
          <li key={img.IDProductoImagen}>
            <img src={img.Url} alt={img.TextoAlternativo ?? ''} />
            <small>Orden {img.Orden}</small>
            <button type="button" className="boton-enlace" onClick={() => void quitar(img.IDProductoImagen)}>
              Quitar
            </button>
          </li>
        ))}
      </ul>
      <form className="tarjeta-formulario" onSubmit={agregar} noValidate>
        <h3>Agregar imagen</h3>
        <Campo etiqueta="URL" name="url" type="url" value={datos.url} error={errores.url} onChange={(e) => setDatos({ ...datos, url: e.target.value })} />
        <Campo etiqueta="Texto alternativo" name="textoAlt" value={datos.texto} error={errores.texto} onChange={(e) => setDatos({ ...datos, texto: e.target.value })} />
        <Campo etiqueta="Orden" name="ordenImagen" inputMode="numeric" value={datos.orden} error={errores.orden} onChange={(e) => setDatos({ ...datos, orden: e.target.value })} />
        <button type="submit" className="boton boton-principal" disabled={enviando}>
          {enviando ? 'Agregando…' : 'Agregar imagen'}
        </button>
      </form>
    </section>
  );
}

export function ProductoEditar() {
  const { id = 'nuevo' } = useParams();
  const navegar = useNavigate();
  const nuevo = id === 'nuevo';
  const r = useApi(() => (nuevo ? Promise.resolve(null) : api<Producto>(`/productos/${id}`)), id);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  useEffect(() => setProducto(r.datos), [r.datos]);
  const avisar: Avisar = (tipo, texto) => setAviso({ tipo, texto });

  async function eliminar() {
    if (!producto || !window.confirm(`¿Eliminar ${producto.Nombre}? Si tiene ventas o movimientos solo se desactivará.`)) return;
    try {
      const res = await api<{ Resultado: string }>(`/productos/${producto.IDProducto}`, { metodo: 'DELETE' });
      if (res.Resultado === 'Desactivado') {
        avisar('ok', 'El producto tiene historial: se desactivó.');
        r.recargar();
      } else navegar('/panel/productos');
    } catch (e) {
      avisar('error', mensajeDe(e));
    }
  }

  return (
    <section>
      <p>
        <Link to="/panel/productos">Productos</Link>
      </p>
      <h1>{nuevo ? 'Nuevo producto' : (producto?.Nombre ?? `Producto ${id}`)}</h1>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      {r.cargando && !producto && <EsqueletoFilas />}
      {r.error && <MensajeError mensaje={r.error} reintentar={r.recargar} />}
      {!r.cargando && !r.error && (
        <>
          <DatosProducto
            key={producto?.IDProducto ?? 'nuevo'}
            producto={producto}
            guardado={(p) => {
              setProducto(p);
              if (nuevo) navegar(`/panel/productos/${p.IDProducto}`, { replace: true });
            }}
          />
          {producto && (
            <>
              <Variantes producto={producto} cambiar={setProducto} avisar={avisar} />
              <Imagenes producto={producto} cambiar={setProducto} avisar={avisar} />
              <button type="button" className="boton boton-peligro" onClick={() => void eliminar()}>
                Eliminar producto
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
