// Carrusel de promociones: se desliza con el dedo (scroll-snap), avanza solo cada 5 segundos
// y los puntos indican y permiten elegir la diapositiva.
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Carrusel({ diapositivas }: { diapositivas: ReactNode[] }) {
  const pista = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = diapositivas.length;

  function ir(indice: number) {
    const el = pista.current;
    if (el) el.scrollTo({ left: indice * el.clientWidth, behavior: 'smooth' });
  }

  // La diapositiva visible se calcula con la posición del desplazamiento.
  function alDesplazar() {
    const el = pista.current;
    if (el && el.clientWidth) setActual(Math.round(el.scrollLeft / el.clientWidth));
  }

  useEffect(() => {
    if (pausado || total < 2) return;
    const id = window.setInterval(() => ir((actual + 1) % total), 5000);
    return () => window.clearInterval(id);
  }, [actual, pausado, total]);

  if (total === 0) return null;
  return (
    <section
      className="carrusel"
      aria-roledescription="carrusel"
      aria-label="Promociones"
      onPointerEnter={() => setPausado(true)}
      onPointerLeave={() => setPausado(false)}
      onTouchStart={() => setPausado(true)}
      onTouchEnd={() => setPausado(false)}
    >
      <div className="carrusel-pista" ref={pista} onScroll={alDesplazar}>
        {diapositivas.map((d, i) => (
          <div key={i} className="carrusel-diapositiva" aria-roledescription="diapositiva" aria-label={`${i + 1} de ${total}`}>
            {d}
          </div>
        ))}
      </div>
      <div className="carrusel-puntos">
        {diapositivas.map((_, i) => (
          <button key={i} type="button" className={i === actual ? 'activo' : ''} aria-label={`Ir a la promoción ${i + 1}`} aria-current={i === actual || undefined} onClick={() => ir(i)} />
        ))}
      </div>
    </section>
  );
}
