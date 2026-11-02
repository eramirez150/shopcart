// Detalle de producto: foto grande con miniaturas, precio, variantes, descripción,
// cantidad, barra fija para agregar al carrito, reseñas y productos relacionados.
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, mensajeDe } from '../api/cliente';
import type { Producto, Variante } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Aviso, EsqueletoDetalle, MensajeError, Vacio } from '../componentes/Estados';
import { SinFoto } from '../componentes/Ilustraciones';
import { Precio } from '../componentes/Precio';
import { textoAtributos } from '../formato';
import { useCarrito } from './CarritoContexto';
import { Icono } from './Iconos';
import { Relacionados } from './Relacionados';
import { Resenas } from './Resenas';

const nombreVariante = (v: Variante) => textoAtributos(v.Atributos) || v.SKU;

// Los productos usan INT en la base: fuera de ese rango no puede existir ninguno.
const ID_MAXIMO = 2147483647;
const esIdValido = (id: string) => /^[1-9]\d*$/.test(id) && Number(id) <= ID_MAXIMO;

export function SelectorCantidad({ valor, maximo, cambiar, deshabilitado }: { valor: number; maximo: number; cambiar: (n: number) => void; deshabilitado?: boolean }) {
  return (
    <div className="cantidad" role="group" aria-label="Cantidad">
      <button type="button" className="boton-icono" aria-label="Quitar uno" disabled={deshabilitado || valor <= 1} onClick={() => cambiar(valor - 1)}>
        <Icono nombre="menos" />
      </button>
      <span aria-live="polite">{valor}</span>
      <button type="button" className="boton-icono" aria-label="Agregar uno" disabled={deshabilitado || valor >= maximo} onClick={() => cambiar(valor + 1)}>
        <Icono nombre="mas" />
      </button>
    </div>
  );
}

function Contenido({ producto }: { producto: Producto }) {
  const { agregar } = useCarrito();
  const activas = producto.variantes.filter((v) => v.Activa);
  const [idVariante, setIdVariante] = useState(() => (activas.find((v) => v.Disponible > 0) ?? activas[0])?.IDVariante);
  const [foto, setFoto] = useState(0);
  const [cantidad, setCantidad] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const variante = activas.find((v) => v.IDVariante === idVariante);
  const disponible = Math.min(variante?.Disponible ?? 0, 1000);
  const imagenes = [...producto.imagenes].sort((a, b) => a.Orden - b.Orden);
  const imagen = imagenes[foto];

  async function agregarAlCarrito() {
    if (!variante || enviando) return;
    setEnviando(true);
    setAviso(null);
    try {
      await agregar(variante.IDVariante, cantidad);
      setAviso({ tipo: 'ok', texto: 'Producto agregado al carrito.' });
      setCantidad(1);
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDe(e) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="detalle">
      <div className="detalle-galeria">
        <div className="detalle-foto">{imagen ? <img src={imagen.Url} alt={imagen.TextoAlternativo ?? producto.Nombre} /> : <SinFoto categoria={producto.Categoria} />}</div>
        {imagenes.length > 1 && (
          <div className="miniaturas">
            {imagenes.map((img, i) => (
              <button key={img.IDProductoImagen} type="button" className={i === foto ? 'activa' : ''} aria-label={`Ver foto ${i + 1}`} onClick={() => setFoto(i)}>
                <img src={img.Url} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="detalle-info">
        <Link className="detalle-categoria" to={`/buscar?idCategoria=${producto.IDCategoria}`}>
          {producto.Categoria}
        </Link>
        <h1 className="detalle-nombre">{producto.Nombre}</h1>
        <p className="detalle-precio">{variante ? <Precio valor={variante.Precio} tamano="grande" /> : 'No disponible'}</p>

        {activas.length > 1 && (
          <fieldset className="opciones">
            <legend>Opciones</legend>
            {activas.map((v) => (
              <button
                key={v.IDVariante}
                type="button"
                className={`opcion ${v.IDVariante === idVariante ? 'elegida' : ''}`}
                aria-pressed={v.IDVariante === idVariante}
                disabled={v.Disponible <= 0}
                onClick={() => {
                  setIdVariante(v.IDVariante);
                  setCantidad(1);
                }}
              >
                {nombreVariante(v)}
                {v.Disponible <= 0 && ' (agotado)'}
              </button>
            ))}
          </fieldset>
        )}
        {activas.length === 1 && variante && textoAtributos(variante.Atributos) && <p>{nombreVariante(variante)}</p>}

        <div className="detalle-cantidad">
          <span>Cantidad</span>
          <SelectorCantidad valor={cantidad} maximo={Math.max(1, disponible)} cambiar={setCantidad} deshabilitado={disponible === 0} />
          <span className="texto-suave">{disponible > 0 ? `${variante?.Disponible} disponibles` : 'Agotado'}</span>
        </div>

        {producto.Descripcion && (
          <section>
            <h2>Descripción</h2>
            <p>{producto.Descripcion}</p>
          </section>
        )}
        {aviso && (
          <Aviso tipo={aviso.tipo}>
            {aviso.texto} {aviso.tipo === 'ok' && <Link to="/carrito">Ver carrito</Link>}
          </Aviso>
        )}
      </div>

      <div className="barra-agregar">
        <div>
          <small className="texto-suave">Total</small>
          <strong>{variante ? <Precio valor={Math.round(variante.Precio * cantidad * 100) / 100} /> : '—'}</strong>
        </div>
        <button type="button" className="boton boton-principal" disabled={!variante || disponible === 0 || enviando} onClick={() => void agregarAlCarrito()}>
          {enviando ? 'Agregando…' : 'Agregar al carrito'}
        </button>
      </div>

      <div className="detalle-extra">
        <Resenas idProducto={producto.IDProducto} />
        <Relacionados idProducto={producto.IDProducto} />
      </div>
    </main>
  );
}

function CargaProducto({ id }: { id: string }) {
  const r = useApi(() => api<Producto>(`/productos/${id}`), id);
  if (r.cargando) return <EsqueletoDetalle />;
  if (r.error || !r.datos)
    return (
      <main className="contenedor">
        <MensajeError titulo="No se pudo mostrar el producto" mensaje={r.error ?? 'El producto no existe.'} reintentar={r.recargar} />
        <Link to="/">Volver al inicio</Link>
      </main>
    );
  return <Contenido key={r.datos.IDProducto} producto={r.datos} />;
}

export function Detalle() {
  const { id = '' } = useParams();
  if (!esIdValido(id))
    return (
      <main className="contenedor">
        <Vacio titulo="Este producto no existe" ilustracion="busqueda">
          <Link to="/" className="boton boton-principal">
            Ir al inicio
          </Link>
        </Vacio>
      </main>
    );
  return <CargaProducto id={id} />;
}
