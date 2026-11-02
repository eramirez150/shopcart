import type { ReactElement } from 'react';
import type { NombreIcono } from '../tienda/Iconos';

// Ilustraciones de los estados vacíos y de error, dibujadas para ShopCart.
// Todas siguen el mismo trazo: un círculo plateado detrás y línea de tinta encima.
export type NombreIlustracion = 'carrito' | 'busqueda' | 'pedidos' | 'direcciones' | 'error' | 'vacio';

const dibujos: Record<NombreIlustracion, ReactElement> = {
  carrito: (
    <>
      <path d="M26 38h12l10 46h46l9-32H44" />
      <path className="ilu-acento" d="M58 60h30M61 70h23" />
      <circle cx="54" cy="96" r="5" />
      <circle cx="88" cy="96" r="5" />
    </>
  ),
  busqueda: (
    <>
      <circle cx="56" cy="56" r="22" />
      <path d="M72 72l20 20" />
      <path className="ilu-acento" d="M48 52c2-5 6-8 12-8" />
    </>
  ),
  pedidos: (
    <>
      <path d="M30 46l30-14 30 14v34L60 94 30 80z" />
      <path d="M30 46l30 14 30-14M60 60v34" />
      <path className="ilu-acento" d="M44 39l30 14" />
    </>
  ),
  direcciones: (
    <>
      <path d="M60 94S36 70 36 52a24 24 0 0 1 48 0c0 18-24 42-24 42z" />
      <circle className="ilu-acento" cx="60" cy="52" r="8" />
    </>
  ),
  error: (
    <>
      <path d="M60 28l34 60H26z" />
      <path className="ilu-acento" d="M60 50v18M60 77v1" />
    </>
  ),
  vacio: (
    <>
      <rect x="32" y="34" width="56" height="52" rx="8" />
      <path className="ilu-acento" d="M44 52h32M44 64h20" />
    </>
  ),
};

// Siluetas sólidas de las promociones, de contornos rectos para que se lean de un vistazo
// sobre el color. Una categoría sin silueta propia usa la etiqueta.
const ETIQUETA = 'M12 12h50l48 48-50 50-48-48zM34 24a10 10 0 1 0 0 20 10 10 0 0 0 0-20z';
const siluetas: Partial<Record<NombreIcono, string>> = {
  calzado: 'M14 36h20c2 9 9 13 16 12l10 14 6-4 6 9 6-4 6 8c14 3 28 9 28 20v5H8zM8 100h104v12H8z',
  cocina: 'M50 18h20v12H50zM28 34h64l8 14H20zM20 52h80v44q0 16-16 16H36q-16 0-16-16zM4 60h12v16H4zM104 60h12v16h-12z',
  computacion: 'M20 26h80v66H20zM29 35v48h62V35zM4 98h112l-8 14H12z',
  deportes: 'M2 66h12v28H2zM18 48h18v64H18zM40 72h40v16H40zM84 48h18v64H84zM106 66h12v28h-12z',
  electronica: 'M18 70V60a42 42 0 0 1 84 0v10H90V60a30 30 0 0 0-60 0v10zM12 74h24v38H12zM84 74h24v38H84z',
  hogar: 'M60 10l56 46H4zM16 60h88v52H74V80H46v32H16z',
  juguetes: 'M12 66h46v46H12zM62 66h46v46H62zM37 16h46v46H37z',
  ropa: 'M40 14c5 12 35 12 40 0l36 20-12 26-16-7v59H32V53l-16 7L4 34z',
};

export function Silueta({ icono }: { icono: NombreIcono }) {
  return (
    <svg className="silueta" viewBox="0 0 120 120" aria-hidden="true">
      <path fillRule="evenodd" d={siluetas[icono] ?? ETIQUETA} />
    </svg>
  );
}

export function Ilustracion({ nombre }: { nombre: NombreIlustracion }) {
  return (
    <svg className="ilustracion" viewBox="0 0 120 120" aria-hidden="true">
      <circle className="ilu-fondo" cx="60" cy="62" r="46" />
      <g className="ilu-trazo">{dibujos[nombre]}</g>
    </svg>
  );
}
