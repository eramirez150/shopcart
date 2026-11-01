// Formatos de pantalla para montos, fechas y atributos.
import type { Atributos, EstadoPedido } from './api/tipos';

const moneda = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
const fechaCorta = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium' });
const fechaHora = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' });

export const quetzales = (n: number) => moneda.format(n);
export const fecha = (iso: string) => fechaCorta.format(new Date(iso));
export const fechaYHora = (iso: string) => fechaHora.format(new Date(iso));

export const NOMBRE_ESTADO: Record<EstadoPedido, string> = {
  Pagado: 'Pagado',
  EnPreparacion: 'En preparación',
  Despachado: 'Despachado',
  Entregado: 'Entregado',
  DevueltoParcial: 'Devuelto en parte',
  Devuelto: 'Devuelto',
  Cancelado: 'Cancelado',
};

// { Color: 'Negro', Talla: 'M' } -> "Negro · M"
export function textoAtributos(a: Atributos | string | null | undefined): string {
  if (!a) return '';
  let objeto: Atributos;
  try {
    objeto = typeof a === 'string' ? (JSON.parse(a) as Atributos) : a;
  } catch {
    return '';
  }
  return Object.values(objeto).join(' · ');
}

// Fecha de hoy en formato AAAA-MM-DD, hora local.
export function hoyISO(desplazamientoDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + desplazamientoDias);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}
