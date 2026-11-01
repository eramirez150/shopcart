// Carrito compartido por la tienda: lo usan el encabezado (contador), el detalle, el carrito y el checkout.
// Con sesión es el carrito de la cuenta; sin sesión es el de invitado, identificado por su token.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, mensajeDe, tokenCarrito } from '../api/cliente';
import type { Carrito } from '../api/tipos';
import { useSesion } from '../sesion/SesionContexto';

interface ValorCarrito {
  carrito: Carrito | null;
  cargando: boolean;
  error: string | null;
  unidades: number;
  recargar: () => Promise<void>;
  agregar: (idVariante: number, cantidad: number) => Promise<void>;
  cambiarCantidad: (idVariante: number, cantidad: number) => Promise<void>;
  quitar: (idVariante: number) => Promise<void>;
  aplicarCupon: (codigo: string) => Promise<void>;
  quitarCupon: () => Promise<void>;
}

const Contexto = createContext<ValorCarrito | null>(null);

export function ProveedorCarrito({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();
  const [carrito, setCarrito] = useState<Carrito | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Toda respuesta de escritura trae el carrito completo; el primer agregado de un
  // invitado trae además su token, que se guarda para las siguientes peticiones.
  const usar = useCallback(
    (c: Carrito) => {
      if (!usuario && c.TokenInvitado) tokenCarrito.guardar(c.TokenInvitado);
      setCarrito(c);
    },
    [usuario],
  );

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      usar(await api<Carrito>('/carrito'));
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setCargando(false);
    }
  }, [usar]);

  // Al entrar o salir cambia el dueño del carrito.
  useEffect(() => {
    void recargar();
  }, [usuario?.id, recargar]);

  const escribir = (ruta: string, metodo: 'POST' | 'PATCH' | 'PUT' | 'DELETE', cuerpo?: unknown) =>
    api<Carrito>(ruta, { metodo, cuerpo }).then(usar);

  const valor: ValorCarrito = {
    carrito,
    cargando,
    error,
    unidades: carrito?.lineas.reduce((s, l) => s + l.Cantidad, 0) ?? 0,
    recargar,
    agregar: (idVariante, cantidad) => escribir('/carrito/items', 'POST', { idVariante, cantidad }),
    cambiarCantidad: (idVariante, cantidad) => escribir(`/carrito/items/${idVariante}`, 'PATCH', { cantidad }),
    quitar: (idVariante) => escribir(`/carrito/items/${idVariante}`, 'DELETE'),
    aplicarCupon: (codigo) => escribir('/carrito/cupon', 'PUT', { codigo }),
    quitarCupon: () => escribir('/carrito/cupon', 'DELETE'),
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCarrito(): ValorCarrito {
  const v = useContext(Contexto);
  if (!v) throw new Error('useCarrito debe usarse dentro de ProveedorCarrito');
  return v;
}
