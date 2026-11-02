// Reseñas del producto: promedio, lista con "Ver más" y formulario para quien puede reseñar.
import { useState, type FormEvent } from 'react';
import { api, ErrorApi, mensajeDe } from '../api/cliente';
import type { PermisoResena, Resena, ResenasProducto } from '../api/tipos';
import { useApi } from '../api/useApi';
import { Aviso, EsqueletoFilas, MensajeError, Vacio } from '../componentes/Estados';
import { fecha } from '../formato';
import { useSesion } from '../sesion/SesionContexto';
import { maximo, requerido, sinErrores } from '../validacion';

const POR_PAGINA = 5;
const MAXIMO_COMENTARIO = 1000;

const pedirPagina = (idProducto: number, pagina: number) =>
  api<ResenasProducto>(`/productos/${idProducto}/resenas`, { consulta: { pagina, tamano: POR_PAGINA } });

function Estrellas({ valor }: { valor: number }) {
  const llenas = Math.round(valor);
  return (
    <span className="estrellas" role="img" aria-label={`${valor.toFixed(1)} de 5 estrellas`}>
      <span className="estrellas-llenas">{'★'.repeat(llenas)}</span>
      {'★'.repeat(5 - llenas)}
    </span>
  );
}

// Solo se muestra si la API confirma que este cliente puede reseñar el producto.
function Formulario({ idProducto, alCrear }: { idProducto: number; alCrear: () => void }) {
  const permiso = useApi(() => api<PermisoResena>(`/productos/${idProducto}/resenas/permiso`), String(idProducto));
  const [calificacion, setCalificacion] = useState(0);
  const [comentario, setComentario] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorApi, setErrorApi] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!permiso.datos?.puede) return null;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const invalidos = sinErrores({
      calificacion: calificacion ? undefined : 'Elige de 1 a 5 estrellas.',
      comentario: requerido(comentario, 'Escribe un comentario.') ?? maximo(comentario, MAXIMO_COMENTARIO),
    });
    setErrores(invalidos ?? {});
    setErrorApi('');
    if (invalidos || enviando) return;
    setEnviando(true);
    try {
      await api<Resena>(`/productos/${idProducto}/resenas`, { metodo: 'POST', cuerpo: { calificacion, comentario: comentario.trim() } });
      alCrear();
    } catch (error) {
      if (error instanceof ErrorApi && Object.keys(error.campos()).length > 0) setErrores(error.campos());
      else setErrorApi(mensajeDe(error));
      setEnviando(false);
    }
  }

  return (
    <form className="resena-formulario" onSubmit={(e) => void enviar(e)} noValidate>
      <h3>Califica este producto</h3>
      <fieldset className="calificar">
        <legend>Tu calificación</legend>
        <div className="calificar-estrellas">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={n <= calificacion ? 'llena' : ''}>
              <input
                type="radio"
                name="calificacion"
                className="oculto-visual"
                aria-label={`${n} de 5 estrellas`}
                checked={n === calificacion}
                onChange={() => setCalificacion(n)}
              />
              <span aria-hidden="true">★</span>
            </label>
          ))}
        </div>
        {errores['calificacion'] && <small className="campo-error">{errores['calificacion']}</small>}
      </fieldset>
      <div className="campo">
        <label htmlFor="resena-comentario">Tu comentario</label>
        <textarea
          id="resena-comentario"
          value={comentario}
          maxLength={MAXIMO_COMENTARIO}
          aria-invalid={errores['comentario'] ? true : undefined}
          aria-describedby={errores['comentario'] ? 'resena-comentario-error' : undefined}
          onChange={(e) => setComentario(e.target.value)}
        />
        {errores['comentario'] && (
          <small id="resena-comentario-error" className="campo-error">
            {errores['comentario']}
          </small>
        )}
      </div>
      {errorApi && <Aviso tipo="error">{errorApi}</Aviso>}
      <button type="submit" className="boton boton-principal boton-ancho" disabled={enviando}>
        {enviando ? 'Publicando…' : 'Publicar reseña'}
      </button>
    </form>
  );
}

export function Resenas({ idProducto }: { idProducto: number }) {
  const { usuario } = useSesion();
  const r = useApi(() => pedirPagina(idProducto, 1), String(idProducto));
  const [siguientes, setSiguientes] = useState<Resena[]>([]);
  const [pagina, setPagina] = useState(1);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMas, setErrorMas] = useState('');
  const [creada, setCreada] = useState(false);

  const lista = [...(r.datos?.datos ?? []), ...siguientes];
  const total = r.datos?.total ?? 0;

  async function verMas() {
    setCargandoMas(true);
    setErrorMas('');
    try {
      const siguiente = await pedirPagina(idProducto, pagina + 1);
      // Si llegó una reseña nueva, las páginas se corren: se omite la que ya está en pantalla.
      const nuevas = siguiente.datos.filter((n) => !lista.some((v) => v.IDResena === n.IDResena));
      setSiguientes((s) => [...s, ...nuevas]);
      setPagina(pagina + 1);
    } catch (e) {
      setErrorMas(mensajeDe(e));
    } finally {
      setCargandoMas(false);
    }
  }

  function alCrear() {
    setCreada(true);
    setSiguientes([]);
    setPagina(1);
    r.recargar();
  }

  return (
    <section className="seccion resenas" aria-labelledby="resenas-titulo">
      <div className="seccion-cabeza">
        <h2 id="resenas-titulo">Reseñas</h2>
      </div>
      {r.cargando && !r.datos && <EsqueletoFilas filas={3} />}
      {r.error && <MensajeError titulo="No se pudieron cargar las reseñas" mensaje={r.error} reintentar={r.recargar} />}
      {r.datos && !r.error && total === 0 && <Vacio titulo="Todavía no hay reseñas." />}
      {r.datos && !r.error && total > 0 && (
        <>
          <div className="resenas-resumen">
            <strong className="resenas-promedio">{(r.datos.promedio ?? 0).toFixed(1)}</strong>
            <div>
              <Estrellas valor={r.datos.promedio ?? 0} />
              <p className="texto-suave">{total === 1 ? '1 reseña' : `${total} reseñas`}</p>
            </div>
          </div>
          <p className="resenas-aviso">Reseñas de compras verificadas</p>
          <ul className="resenas-lista">
            {lista.map((resena) => (
              <li key={resena.IDResena} className="resena">
                <div className="resena-cabeza">
                  <strong>{resena.Autor}</strong>
                  <time className="texto-suave" dateTime={resena.Fecha}>
                    {fecha(resena.Fecha)}
                  </time>
                </div>
                <Estrellas valor={resena.Calificacion} />
                <p className="resena-comentario">{resena.Comentario}</p>
              </li>
            ))}
          </ul>
          {errorMas && <Aviso tipo="error">{errorMas}</Aviso>}
          {lista.length < total && (
            <button type="button" className="boton boton-secundario boton-ancho" disabled={cargandoMas} onClick={() => void verMas()}>
              {cargandoMas ? 'Cargando…' : 'Ver más'}
            </button>
          )}
        </>
      )}
      {creada && <Aviso tipo="ok">Gracias, tu reseña ya está publicada.</Aviso>}
      {usuario?.rol === 'Cliente' && !creada && <Formulario key={usuario.id} idProducto={idProducto} alCrear={alCrear} />}
    </section>
  );
}
