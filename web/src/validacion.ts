// Validaciones de formulario. Devuelven el mensaje de error o undefined si el valor es válido.
// La API vuelve a validar todo: esto solo evita viajes inútiles y explica el problema antes.

export const requerido = (v: string, mensaje = 'Este campo es obligatorio.') => (v.trim() ? undefined : mensaje);

export function correo(v: string) {
  if (!v.trim()) return 'Escribe tu correo.';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? undefined : 'El correo no tiene un formato válido.';
}

export function claveNueva(v: string) {
  if (v.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (v.length > 72) return 'La contraseña admite como máximo 72 caracteres.';
  return undefined;
}

export function maximo(v: string, n: number) {
  return v.trim().length > n ? `Máximo ${n} caracteres.` : undefined;
}

export function numero(v: string, { min, entero = false, nombre = 'El valor' }: { min?: number; entero?: boolean; nombre?: string } = {}) {
  if (v.trim() === '') return 'Este campo es obligatorio.';
  const n = Number(v);
  if (!Number.isFinite(n)) return `${nombre} debe ser un número.`;
  if (entero && !Number.isInteger(n)) return `${nombre} debe ser un número entero.`;
  if (min !== undefined && n < min) return `${nombre} debe ser mayor o igual a ${min}.`;
  if (!entero && Math.round(n * 100) !== n * 100) return `${nombre} admite como máximo dos decimales.`;
  return undefined;
}

// Tope superior para un número que ya pasó `numero`.
export function tope(v: string, max: number, nombre = 'El valor') {
  return Number(v) > max ? `${nombre} no puede pasar de ${max}.` : undefined;
}

// Quita las entradas sin error; si el objeto queda vacío, el formulario es válido.
export function sinErrores(errores: Record<string, string | undefined>): Record<string, string> | null {
  const r: Record<string, string> = {};
  for (const [k, v] of Object.entries(errores)) if (v) r[k] = v;
  return Object.keys(r).length ? r : null;
}
