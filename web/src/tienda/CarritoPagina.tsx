// Carrito: vacío muestra una ilustración, accesos y sugerencias; con productos muestra
// líneas, cantidades, cupón y totales calculados por la API.
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { mensajeDe } from '../api/cliente';
import type { LineaCarrito } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Ilustracion, SinFoto } from '../componentes/Ilustraciones';
import { Precio } from '../componentes/Precio';
import { Aviso, EsqueletoFilas, EsqueletoGrilla, MensajeError } from '../componentes/Estados';
import { quetzales, textoAtributos } from '../formato';
import { useSesion } from '../sesion/SesionContexto';
import { useCarrito } from './CarritoContexto';
import { SelectorCantidad } from './Detalle';
import { Icono } from './Iconos';
import { buscarProductos } from './Inicio';
import { GrillaProductos } from './TarjetaProducto';

function CarritoVacio() {
  const { usuario } = useSesion();
  const sugeridos = useApi(() => buscarProductos({ orden: 'recientes', soloDisponibles: true, tamano: 6 }), 'sugeridos');
  return (
    <main className="contenedor">
      <div className="carrito-vacio">
        <Ilustracion nombre="carrito" />
        <h1>Tu carrito está vacío</h1>
        <Link to="/buscar?orden=precio_asc&soloDisponibles=true">Ver ofertas</Link>
        {!usuario && (
          <div className="acciones-vacio">
            <Link to="/login?volver=/carrito" className="boton boton-principal">
              Iniciar sesión
            </Link>
            <Link to="/registro?volver=/carrito" className="boton boton-secundario">
              Crear cuenta
            </Link>
          </div>
        )}
      </div>
      <section className="seccion">
        <div className="seccion-cabeza">
          <h2>Te puede interesar</h2>
          <Link to="/buscar?orden=recientes" className="ver-mas">
            Ver más <Icono nombre="flecha" />
          </Link>
        </div>
        {sugeridos.cargando && <EsqueletoGrilla />}
        {sugeridos.error && <MensajeError mensaje={sugeridos.error} reintentar={sugeridos.recargar} />}
        {sugeridos.datos && <GrillaProductos productos={sugeridos.datos.datos} />}
      </section>
    </main>
  );
}

function Linea({ linea }: { linea: LineaCarrito }) {
  const { cambiarCantidad, quitar } = useCarrito();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function hacer(accion: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    try {
      await accion();
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <li className="linea-carrito">
      <div className="linea-foto">
        {linea.ImagenPrincipal ? <img src={linea.ImagenPrincipal} alt="" loading="lazy" /> : <SinFoto categoria="" />}
      </div>
      <div className="linea-datos">
        <strong>{linea.Producto}</strong>
        <small className="texto-suave">{textoAtributos(linea.Atributos) || linea.SKU}</small>
        <span>{quetzales(linea.PrecioUnitario)} c/u</span>
      </div>
      <div className="linea-acciones">
        <SelectorCantidad
          valor={linea.Cantidad}
          maximo={Math.max(linea.Cantidad, Math.min(linea.Disponible, 1000))}
          deshabilitado={ocupado}
          cambiar={(n) => void hacer(() => cambiarCantidad(linea.IDVariante, n))}
        />
        <button type="button" className="boton-icono" aria-label={`Quitar ${linea.Producto}`} disabled={ocupado} onClick={() => void hacer(() => quitar(linea.IDVariante))}>
          <Icono nombre="basura" />
        </button>
      </div>
      <div className="linea-total">
        {linea.Descuento > 0 && <Precio valor={linea.Subtotal} tamano="chico" tachado />}
        <Precio valor={linea.Total} />
      </div>
      {error && <p className="campo-error linea-error">{error}</p>}
    </li>
  );
}

// Formulario de cupón. La API exige sesión para aplicar cupones.
export function FormularioCupon() {
  const { usuario } = useSesion();
  const { carrito, aplicarCupon, quitarCupon } = useCarrito();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (!usuario) {
    return (
      <p className="texto-suave">
        <Link to="/login?volver=/carrito">Inicia sesión</Link> para usar un cupón.
      </p>
    );
  }

  async function hacer(accion: () => Promise<void>) {
    setOcupado(true);
    setError('');
    try {
      await accion();
      setCodigo('');
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setOcupado(false);
    }
  }

  function aplicar(e: FormEvent) {
    e.preventDefault();
    const c = codigo.trim();
    if (!c) return setError('Escribe el código del cupón.');
    if (!ocupado) void hacer(() => aplicarCupon(c));
  }

  if (carrito?.Cupon) {
    return (
      <div className="cupon-aplicado">
        <span>
          Cupón <strong>{carrito.Cupon}</strong> aplicado
        </span>
        <button type="button" className="boton-enlace" disabled={ocupado} onClick={() => void hacer(quitarCupon)}>
          Quitar
        </button>
        {error && <Aviso tipo="error">{error}</Aviso>}
      </div>
    );
  }

  return (
    <form className="cupon" onSubmit={aplicar} noValidate>
      <label htmlFor="cupon" className="oculto-visual">
        Código de cupón
      </label>
      <input id="cupon" className="control" placeholder="Código de cupón" value={codigo} maxLength={30} onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
      <button type="submit" className="boton boton-secundario" disabled={ocupado}>
        Aplicar
      </button>
      {error && <p className="campo-error cupon-error">{error}</p>}
    </form>
  );
}

export function Totales({ subtotal, descuento, total }: { subtotal: number; descuento: number; total: number }) {
  return (
    <dl className="totales">
      <div>
        <dt>Subtotal</dt>
        <dd>{quetzales(subtotal)}</dd>
      </div>
      <div>
        <dt>Descuento</dt>
        <dd>{descuento > 0 ? `− ${quetzales(descuento)}` : quetzales(0)}</dd>
      </div>
      <div className="totales-total">
        <dt>Total</dt>
        <dd>
          <Precio valor={total} tamano="grande" />
        </dd>
      </div>
      <p className="texto-suave">Los precios incluyen IVA.</p>
    </dl>
  );
}

export function CarritoPagina() {
  const { carrito, cargando, error, recargar, unidades } = useCarrito();
  const { usuario } = useSesion();
  const navegar = useNavigate();

  if (cargando && !carrito) return <main className="contenedor"><EsqueletoFilas filas={3} /></main>;
  if (error && !carrito) return <MensajeError mensaje={error} reintentar={() => void recargar()} />;
  if (!carrito || carrito.lineas.length === 0) return <CarritoVacio />;

  return (
    <main className="contenedor carrito">
      <h1>Carrito ({unidades})</h1>
      <div className="carrito-columnas">
        <ul className="lineas">
          {carrito.lineas.map((l) => (
            <Linea key={l.IDVariante} linea={l} />
          ))}
        </ul>
        <aside className="resumen">
          <FormularioCupon />
          <Totales subtotal={carrito.Subtotal} descuento={carrito.Descuento} total={carrito.Total} />
          <button type="button" className="boton boton-principal boton-ancho" onClick={() => navegar(usuario ? '/checkout' : '/login?volver=/checkout')}>
            Continuar
          </button>
          {!usuario && <p className="texto-suave texto-centro">Para pagar necesitas iniciar sesión. Tu carrito se conserva.</p>}
        </aside>
      </div>
    </main>
  );
}
