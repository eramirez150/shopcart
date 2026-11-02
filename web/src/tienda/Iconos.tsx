// Íconos de línea dibujados para ShopCart (trazos de 24 × 24). El color sale de currentColor.

const trazos = {
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  carrito: 'M3 4h2.5l2.3 11h10.4l2-8H7M10 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM17 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z',
  inicio: 'M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5',
  categorias: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  cuenta: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5',
  mas: 'M12 5v14M5 12h14',
  listo: 'M5 12.5l4.5 4.5L19 7.5',
  flecha: 'M5 12h14M13 6l6 6-6 6',
  menos: 'M5 12h14',
  cerrar: 'M6 6l12 12M18 6L6 18',
  atras: 'M15 5l-7 7 7 7',
  basura: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13',
  // Categorías
  electronica: 'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H4zM17 14h3v6h-3z',
  computacion: 'M4 5h16v11H4zM2 19h20M10 16v3h4v-3',
  hogar: 'M3 11l9-7 9 7M5 10v10h14V10M9 20v-6h6v6',
  cocina: 'M5 11h14v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6zM3 11h18M9 7c0-1 1-1.5 1-3M14 7c0-1 1-1.5 1-3',
  ropa: 'M8 4l4 2 4-2 4 4-3 3v9H7v-9L4 8z',
  calzado: 'M3 16V9h5l2 3 6 1.5c2.5.6 5 1.6 5 3.5v1H3zM3 17h18',
  deportes: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 9.5c3 1.5 6 1.5 9-1s5.5-3 8-1.5M3.5 15c3-1 6.5-.5 9 1.5s5 2.5 7 1.5',
  juguetes: 'M12 3l2.5 5.5 6 .7-4.5 4 1.2 6L12 16l-5.2 3.2 1.2-6-4.5-4 6-.7z',
  etiqueta: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
};

export type NombreIcono = keyof typeof trazos;

export function Icono({ nombre, titulo }: { nombre: NombreIcono; titulo?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden={titulo ? undefined : true} role={titulo ? 'img' : undefined}>
      {titulo && <title>{titulo}</title>}
      <path d={trazos[nombre]} />
    </svg>
  );
}

// Ícono de cada categoría según su nombre; una categoría nueva usa la etiqueta genérica.
export function iconoDeCategoria(nombre: string): NombreIcono {
  const clave = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const conocidos: NombreIcono[] = ['electronica', 'computacion', 'hogar', 'cocina', 'ropa', 'calzado', 'deportes', 'juguetes'];
  return conocidos.find((c) => clave.startsWith(c)) ?? 'etiqueta';
}
