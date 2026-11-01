// Checkout en cuatro pasos: dirección, cupón, confirmación (reserva la existencia 15 minutos)
// y pago simulado (crea el pedido). Cada botón que escribe se bloquea mientras espera
// la respuesta para evitar envíos dobles; la API además devuelve la misma reserva y el
// mismo pedido si la petición se repite.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, ErrorApi, mensajeDe } from '../api/cliente';
import type { Direccion, Pedido, Reserva } from '../api/tipos';
import { useApi } from '../api/useApi';
import { CamposDireccion, validarDireccion, type DatosDireccion } from '../componentes/Direccion';
import { Aviso, EsqueletoFilas, MensajeError, Vacio } from '../componentes/Estados';
import { quetzales, textoAtributos } from '../formato';
import { useCarrito } from './CarritoContexto';
import { FormularioCupon, Totales } from './CarritoPagina';

const PASOS = ['Dirección', 'Cupón', 'Confirmación', 'Pago'];

// Elegida: una dirección guardada (id) o una nueva escrita en el formulario.
type Eleccion = { id: number } | { nueva: DatosDireccion };

function PasoDireccion({ seguir }: { seguir: (e: Eleccion, texto: string) => void }) {
  const direcciones = useApi(() => api<Direccion[]>('/direcciones'), 'direcciones');
  const [elegida, setElegida] = useState<number | 'nueva' | null>(null);
  const [nueva, setNueva] = useState<DatosDireccion>({ direccion: '', ciudad: 'Guatemala', telefono: '' });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const lista = direcciones.datos ?? [];
  const actual = elegida ?? (lista[0]?.IDDireccion ?? 'nueva');

  function continuar(e: FormEvent) {
    e.preventDefault();
    if (actual === 'nueva') {
      const encontrados = validarDireccion(nueva);
      setErrores(encontrados ?? {});
      if (!encontrados) seguir({ nueva }, `${nueva.direccion}, ${nueva.ciudad}`);
      return;
    }
    const d = lista.find((x) => x.IDDireccion === actual);
    if (d) seguir({ id: d.IDDireccion }, `${d.Direccion}, ${d.Ciudad}`);
  }

  if (direcciones.cargando) return <EsqueletoFilas />;
  if (direcciones.error) return <MensajeError mensaje={direcciones.error} reintentar={direcciones.recargar} />;

  return (
    <form onSubmit={continuar} noValidate>
      <h2>¿Dónde entregamos tu pedido?</h2>
      <div className="opciones-lista">
        {lista.map((d) => (
          <label key={d.IDDireccion} className={`opcion-fila ${actual === d.IDDireccion ? 'elegida' : ''}`}>
            <input type="radio" name="direccion" checked={actual === d.IDDireccion} onChange={() => setElegida(d.IDDireccion)} />
            <span>
              <strong>{d.Direccion}</strong>
              <small>
                {d.Ciudad} · {d.Telefono}
              </small>
            </span>
          </label>
        ))}
        <label className={`opcion-fila ${actual === 'nueva' ? 'elegida' : ''}`}>
          <input type="radio" name="direccion" checked={actual === 'nueva'} onChange={() => setElegida('nueva')} />
          <span>
            <strong>Registrar una dirección nueva</strong>
          </span>
        </label>
      </div>
      {actual === 'nueva' && <CamposDireccion datos={nueva} errores={errores} cambiar={setNueva} />}
      <button type="submit" className="boton boton-principal boton-ancho">
        Continuar
      </button>
    </form>
  );
}

function Contador({ expira }: { expira: string }) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const restante = Math.max(0, new Date(expira).getTime() - ahora);
  const min = Math.floor(restante / 60000);
  const seg = Math.floor((restante % 60000) / 1000);
  if (restante === 0) return <Aviso tipo="error">La reserva venció. Vuelve a confirmar para reservar otra vez.</Aviso>;
  return (
    <p className="texto-suave">
      Reservamos tus productos por {min}:{String(seg).padStart(2, '0')} minutos.
    </p>
  );
}

export function Checkout() {
  const { carrito, cargando, recargar } = useCarrito();
  const navegar = useNavigate();
  const [paso, setPaso] = useState(0);
  const [eleccion, setEleccion] = useState<Eleccion | null>(null);
  const [textoDireccion, setTextoDireccion] = useState('');
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false); // Bloqueo inmediato: el estado de React tarda un render en aplicarse.

  async function enviar<T>(accion: () => Promise<T>): Promise<T | undefined> {
    if (enCurso.current) return undefined;
    enCurso.current = true;
    setEnviando(true);
    setError('');
    try {
      return await accion();
    } catch (e) {
      setError(mensajeDe(e));
      // Si la reserva venció o el carrito cambió, se vuelve a la confirmación.
      if (e instanceof ErrorApi && e.estado === 409 && paso === 3) {
        setReserva(null);
        setPaso(2);
        void recargar();
      }
      return undefined;
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  }

  async function reservar() {
    if (!eleccion) return;
    const cuerpo = 'id' in eleccion ? { idDireccion: eleccion.id } : eleccion.nueva;
    const r = await enviar(() => api<Reserva>('/checkout/pagos', { metodo: 'POST', cuerpo }));
    if (r) {
      setReserva(r);
      setPaso(3);
    }
  }

  async function pagar() {
    if (!reserva) return;
    const p = await enviar(() => api<Pedido>(`/checkout/reservas/${reserva.IDReserva}/pedido`, { metodo: 'POST' }));
    if (p) {
      await recargar();
      navegar(`/checkout/listo/${p.IDPedido}`, { replace: true });
    }
  }

  async function cancelarPago() {
    if (!reserva) return;
    const r = await enviar(() => api<Reserva>(`/checkout/reservas/${reserva.IDReserva}`, { metodo: 'DELETE' }));
    if (r) {
      setReserva(null);
      setPaso(2);
    }
  }

  if (cargando && !carrito) return <EsqueletoFilas />;
  if (!reserva && (!carrito || carrito.lineas.length === 0)) {
    return (
      <main className="contenedor">
        <Vacio titulo="No hay productos para pagar." ilustracion="carrito">
          <Link to="/" className="boton boton-principal">
            Ir a la tienda
          </Link>
        </Vacio>
      </main>
    );
  }

  return (
    <main className="contenedor checkout">
      <h1>Finalizar compra</h1>
      <ol className="pasos">
        {PASOS.map((p, i) => (
          <li key={p} className={i === paso ? 'actual' : i < paso ? 'hecho' : ''} aria-current={i === paso ? 'step' : undefined}>
            <span>{i + 1}</span> {p}
          </li>
        ))}
      </ol>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {paso === 0 && (
        <PasoDireccion
          seguir={(e, texto) => {
            setEleccion(e);
            setTextoDireccion(texto);
            setPaso(1);
          }}
        />
      )}

      {paso === 1 && carrito && (
        <section>
          <h2>¿Tienes un cupón?</h2>
          <FormularioCupon />
          <Totales subtotal={carrito.Subtotal} descuento={carrito.Descuento} total={carrito.Total} />
          <div className="acciones">
            <button type="button" className="boton boton-secundario" onClick={() => setPaso(0)}>
              Atrás
            </button>
            <button type="button" className="boton boton-principal" onClick={() => setPaso(2)}>
              Continuar
            </button>
          </div>
        </section>
      )}

      {paso === 2 && carrito && (
        <section>
          <h2>Revisa tu pedido</h2>
          <ul className="resumen-lineas">
            {carrito.lineas.map((l) => (
              <li key={l.IDVariante}>
                <span>
                  {l.Cantidad} × {l.Producto} <small className="texto-suave">{textoAtributos(l.Atributos)}</small>
                </span>
                <span>{quetzales(l.Total)}</span>
              </li>
            ))}
          </ul>
          <p>
            <strong>Entrega:</strong> {textoDireccion}
          </p>
          {carrito.Cupon && (
            <p>
              <strong>Cupón:</strong> {carrito.Cupon}
            </p>
          )}
          <Totales subtotal={carrito.Subtotal} descuento={carrito.Descuento} total={carrito.Total} />
          <div className="acciones">
            <button type="button" className="boton boton-secundario" disabled={enviando} onClick={() => setPaso(1)}>
              Atrás
            </button>
            <button type="button" className="boton boton-principal" disabled={enviando} onClick={() => void reservar()}>
              {enviando ? 'Reservando…' : 'Confirmar pedido'}
            </button>
          </div>
        </section>
      )}

      {paso === 3 && reserva && (
        <section>
          <h2>Pago</h2>
          <Contador expira={reserva.Expira} />
          <p className="aviso">Pago simulado: no se cobra a ninguna tarjeta. Al pagar se crea el pedido.</p>
          <p>
            <strong>Entrega:</strong> {reserva.Direccion}, {reserva.Ciudad} · {reserva.Telefono}
          </p>
          <Totales subtotal={reserva.Subtotal} descuento={reserva.Descuento} total={reserva.Total} />
          <div className="acciones">
            <button type="button" className="boton boton-secundario" disabled={enviando} onClick={() => void cancelarPago()}>
              Cancelar pago
            </button>
            <button type="button" className="boton boton-principal" disabled={enviando} onClick={() => void pagar()}>
              {enviando ? 'Procesando…' : `Pagar ${quetzales(reserva.Total)}`}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

// Confirmación después de pagar.
export function PedidoConfirmado() {
  const { id } = useParams();
  return (
    <main className="contenedor">
      <Vacio titulo={`Pedido #${id} confirmado`}>
        <p>Gracias por tu compra. Puedes seguir el estado del pedido en Mi cuenta.</p>
        <div className="acciones">
          <Link to={`/cuenta/pedidos/${id}`} className="boton boton-principal">
            Ver mi pedido
          </Link>
          <Link to="/" className="boton boton-secundario">
            Seguir comprando
          </Link>
        </div>
      </Vacio>
    </main>
  );
}
