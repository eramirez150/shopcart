// Cliente de la API: agrega el token, renueva la sesión cuando el token vence y
// convierte las respuestas de error en ErrorApi con el mensaje que envía el servidor.
import type { Sesion } from './tipos';

const BASE = import.meta.env.VITE_API_URL || '/api';
const CLAVE_SESION = 'shopcart.sesion';
const CLAVE_CARRITO = 'shopcart.carritoInvitado';

export class ErrorApi extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
    public readonly codigo: string,
    public readonly detalle?: unknown,
  ) {
    super(mensaje);
  }

  // Errores de validación de la API: [{ campo, mensaje }] convertido en { campo: mensaje }.
  campos(): Record<string, string> {
    const r: Record<string, string> = {};
    if (Array.isArray(this.detalle)) {
      for (const d of this.detalle as { campo?: string; mensaje?: string }[]) {
        if (d.campo && d.mensaje && !r[d.campo]) r[d.campo] = d.mensaje;
      }
    }
    return r;
  }
}

// ---- Almacenamiento de la sesión y del carrito de invitado.
// Se guarda en localStorage para que la sesión sobreviva a recargar la página.
type Escucha = (s: Sesion | null) => void;
const escuchas = new Set<Escucha>();

export function leerSesion(): Sesion | null {
  try {
    const texto = localStorage.getItem(CLAVE_SESION);
    return texto ? (JSON.parse(texto) as Sesion) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(s: Sesion | null): void {
  if (s) localStorage.setItem(CLAVE_SESION, JSON.stringify(s));
  else localStorage.removeItem(CLAVE_SESION);
  escuchas.forEach((fn) => fn(s));
}

export function alCambiarSesion(fn: Escucha): () => void {
  escuchas.add(fn);
  return () => escuchas.delete(fn);
}

// Otra pestaña inició o cerró sesión, o renovó el token.
window.addEventListener('storage', (e) => {
  if (e.key === CLAVE_SESION) escuchas.forEach((fn) => fn(leerSesion()));
});

export const tokenCarrito = {
  leer: () => localStorage.getItem(CLAVE_CARRITO),
  guardar: (t: string) => localStorage.setItem(CLAVE_CARRITO, t),
  borrar: () => localStorage.removeItem(CLAVE_CARRITO),
};

// ---- Renovación del token.
// El refresh token sirve una sola vez y reusarlo cierra todas las sesiones del usuario,
// así que nunca se pide dos veces con el mismo: las peticiones que fallan a la vez esperan
// la misma promesa, y entre pestañas se usa un bloqueo del navegador (Web Locks).
let renovacion: Promise<boolean> | null = null;

function renovar(refreshUsado: string): Promise<boolean> {
  renovacion ??= conBloqueo(async () => {
    const actual = leerSesion();
    if (!actual) return false;
    // Otra pestaña ya lo renovó mientras esperábamos: basta con usar la sesión nueva.
    if (actual.refreshToken !== refreshUsado) return true;
    const r = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: actual.refreshToken }),
    });
    if (!r.ok) {
      guardarSesion(null);
      return false;
    }
    guardarSesion((await r.json()) as Sesion);
    return true;
  }).finally(() => {
    renovacion = null;
  });
  return renovacion;
}

function conBloqueo<T>(fn: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request('shopcart-renovar', fn) : fn();
}

// ---- Peticiones.
export type Consulta = Record<string, string | number | boolean | null | undefined>;

export interface Opciones {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  cuerpo?: unknown;
  consulta?: Consulta;
  cabeceras?: Record<string, string>;
}

// Arma "?a=1&b=2" omitiendo los valores vacíos.
export function armarConsulta(consulta: Consulta = {}): string {
  const p = new URLSearchParams();
  for (const [clave, valor] of Object.entries(consulta)) {
    if (valor !== undefined && valor !== null && valor !== '') p.set(clave, String(valor));
  }
  const texto = p.toString();
  return texto ? `?${texto}` : '';
}

function enviar(ruta: string, o: Opciones, sesion: Sesion | null): Promise<Response> {
  const cabeceras: Record<string, string> = { ...o.cabeceras };
  if (o.cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (sesion) cabeceras['Authorization'] = `Bearer ${sesion.accessToken}`;
  else {
    const carrito = tokenCarrito.leer();
    if (carrito) cabeceras['X-Carrito-Token'] = carrito;
  }
  return fetch(`${BASE}${ruta}${armarConsulta(o.consulta)}`, {
    method: o.metodo ?? 'GET',
    headers: cabeceras,
    body: o.cuerpo === undefined ? undefined : JSON.stringify(o.cuerpo),
  });
}

async function errorDe(r: Response): Promise<ErrorApi> {
  try {
    const cuerpo = (await r.json()) as { error?: { codigo?: string; mensaje?: string; detalle?: unknown } };
    if (cuerpo.error?.mensaje) return new ErrorApi(r.status, cuerpo.error.mensaje, cuerpo.error.codigo ?? 'ERROR', cuerpo.error.detalle);
  } catch {
    // La respuesta no era JSON: se usa el mensaje genérico.
  }
  return new ErrorApi(r.status, `El servidor respondió ${r.status}`, 'HTTP');
}

export async function api<T>(ruta: string, o: Opciones = {}): Promise<T> {
  const sesion = leerSesion();
  let r: Response;
  try {
    r = await enviar(ruta, o, sesion);
    // Token vencido: se renueva una vez y se repite la petición sin que el usuario lo note.
    if (r.status === 401 && sesion && (await renovar(sesion.refreshToken))) {
      r = await enviar(ruta, o, leerSesion());
    }
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.', 'RED');
  }
  if (!r.ok) throw await errorDe(r);
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}

// Mensaje legible de cualquier error.
export function mensajeDe(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Ocurrió un error inesperado.';
}
