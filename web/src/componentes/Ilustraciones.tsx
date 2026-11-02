import type { ReactElement } from 'react';

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

export function Ilustracion({ nombre }: { nombre: NombreIlustracion }) {
  return (
    <svg className="ilustracion" viewBox="0 0 120 120" aria-hidden="true">
      <circle className="ilu-fondo" cx="60" cy="62" r="46" />
      <g className="ilu-trazo">{dibujos[nombre]}</g>
    </svg>
  );
}
