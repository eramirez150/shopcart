// Filtros, orden y página guardados en la URL (?estado=Pagado&pagina=2).
// Así se pueden compartir, recargar y usar el botón Atrás sin perderlos.
import { useSearchParams } from 'react-router';

export function useFiltros<T extends Record<string, string>>(porDefecto: T) {
  const [params, setParams] = useSearchParams();
  const valores = { ...porDefecto };
  for (const clave of Object.keys(porDefecto) as (keyof T)[]) {
    const v = params.get(clave as string);
    if (v !== null) valores[clave] = v as T[keyof T];
  }
  const pagina = Math.max(1, Number(params.get('pagina') ?? 1) || 1);

  // Cambiar un filtro vuelve a la página 1.
  function cambiar(cambios: Partial<T>) {
    const nuevos = new URLSearchParams(params);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) nuevos.set(clave, valor);
      else nuevos.delete(clave);
    }
    nuevos.delete('pagina');
    setParams(nuevos);
  }

  function irAPagina(n: number) {
    const nuevos = new URLSearchParams(params);
    nuevos.set('pagina', String(n));
    setParams(nuevos);
  }

  return { valores, pagina, cambiar, irAPagina, clave: params.toString() };
}
