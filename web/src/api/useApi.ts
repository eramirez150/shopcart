// Carga datos de la API y expone los estados de carga y error.
// Se vuelve a pedir cuando cambia la "clave" (por ejemplo, los filtros en la URL).
import { useCallback, useEffect, useState } from 'react';
import { mensajeDe } from './cliente';

export interface EstadoCarga<T> {
  datos: T | null;
  cargando: boolean;
  error: string | null;
  recargar: () => void;
}

export function useApi<T>(cargar: () => Promise<T>, clave: string): EstadoCarga<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let vigente = true; // Evita mostrar una respuesta vieja si la clave cambió antes de que llegara.
    setCargando(true);
    setError(null);
    cargar()
      .then((d) => vigente && setDatos(d))
      .catch((e: unknown) => vigente && setError(mensajeDe(e)))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
    // Solo se vuelve a cargar al cambiar la clave o al pedir recargar; la función cambia en cada render.
  }, [clave, vuelta]);

  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  return { datos, cargando, error, recargar };
}
