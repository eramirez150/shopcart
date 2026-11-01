// Estado de la sesión para toda la aplicación: usuario actual, entrar, registrarse y salir.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { alCambiarSesion, api, guardarSesion, leerSesion, tokenCarrito } from '../api/cliente';
import type { Rol, Sesion, Usuario } from '../api/tipos';

interface ValorSesion {
  usuario: Usuario | null;
  iniciarSesion: (correo: string, clave: string) => Promise<Usuario>;
  registrar: (nombre: string, correo: string, clave: string) => Promise<Usuario>;
  cerrarSesion: () => Promise<void>;
}

const Contexto = createContext<ValorSesion | null>(null);

// Al entrar se envía el token del carrito de invitado (lo agrega el cliente de la API)
// para que la API lo fusione con el carrito de la cuenta. Después ya no se necesita.
async function entrar(correo: string, clave: string): Promise<Usuario> {
  const s = await api<Sesion>('/auth/login', { metodo: 'POST', cuerpo: { correo, clave } });
  tokenCarrito.borrar();
  guardarSesion(s);
  return s.usuario;
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => leerSesion()?.usuario ?? null);

  useEffect(() => alCambiarSesion((s) => setUsuario(s?.usuario ?? null)), []);

  const valor: ValorSesion = {
    usuario,
    iniciarSesion: entrar,
    // El registro no fusiona el carrito de invitado: se cierra la sesión que abre
    // y se entra con login, que sí lo fusiona.
    async registrar(nombre, correo, clave) {
      const s = await api<Sesion>('/auth/registro', { metodo: 'POST', cuerpo: { nombre, correo, clave } });
      await api('/auth/logout', { metodo: 'POST', cuerpo: { refreshToken: s.refreshToken } }).catch(() => undefined);
      return entrar(correo, clave);
    },
    async cerrarSesion() {
      const s = leerSesion();
      guardarSesion(null);
      if (s) await api('/auth/logout', { metodo: 'POST', cuerpo: { refreshToken: s.refreshToken } }).catch(() => undefined);
    },
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ValorSesion {
  const v = useContext(Contexto);
  if (!v) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return v;
}

export const esPersonal = (rol?: Rol) => rol === 'Operador' || rol === 'Administrador';

// A dónde va cada rol al entrar.
export const inicioDeRol = (rol: Rol) => (esPersonal(rol) ? '/panel' : '/');
