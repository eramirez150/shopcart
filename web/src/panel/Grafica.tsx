// Gráfica de barras con Chart.js. Una sola serie en el color de acento: el título nombra
// la medida, así que no hace falta leyenda. Al pasar el cursor se ve el valor exacto.
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';
import { useEffect, useRef } from 'react';

// Solo se registran las piezas que se usan, para que el paquete final sea pequeño.
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);
// Misma tipografía que el resto del sitio.
Chart.defaults.font.family = "'Bricolage Grotesque Variable', system-ui, sans-serif";

interface Props {
  etiquetas: string[];
  valores: number[];
  formato: (n: number) => string;
  horizontal?: boolean;
  descripcion: string;
}

export function GraficaBarras({ etiquetas, valores, formato, horizontal = false, descripcion }: Props) {
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!lienzo.current) return;
    const estilo = getComputedStyle(document.documentElement);
    const acento = estilo.getPropertyValue('--acento').trim();
    const texto = estilo.getPropertyValue('--tinta-suave').trim();
    const tinta = estilo.getPropertyValue('--tinta').trim();
    const borde = estilo.getPropertyValue('--linea').trim();
    const ejeValor = { beginAtZero: true, grid: { color: borde }, border: { display: false }, ticks: { color: texto, precision: 0, callback: (v: string | number) => formato(Number(v)) } };
    const ejeCategoria = { grid: { display: false }, ticks: { color: texto, autoSkip: true } };
    const grafica = new Chart(lienzo.current, {
      type: 'bar',
      data: {
        labels: etiquetas,
        datasets: [{ data: valores, backgroundColor: acento, borderRadius: 4, borderSkipped: 'start', maxBarThickness: horizontal ? 16 : 26, hoverBackgroundColor: tinta }],
      },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tinta,
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            titleFont: { weight: 600 },
            bodyFont: { size: 14, weight: 700 },
            callbacks: { label: (c) => formato(Number(c.raw)) },
          },
        },
        scales: horizontal ? { x: ejeValor, y: ejeCategoria } : { x: ejeCategoria, y: ejeValor },
      },
    });
    return () => grafica.destroy();
  }, [etiquetas, valores, formato, horizontal]);

  return (
    <div className="grafica" style={{ height: horizontal ? Math.max(160, etiquetas.length * 34) : 240 }}>
      <canvas ref={lienzo} role="img" aria-label={descripcion} />
    </div>
  );
}
