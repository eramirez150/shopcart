// Estados comunes de cada vista: cargando, vacío y error.
import type { ReactNode } from 'react';

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="estado" role="status" aria-live="polite">
      <span className="girador" aria-hidden="true" />
      <p>{texto}</p>
    </div>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="estado">
      <p className="estado-titulo">{titulo}</p>
      {children}
    </div>
  );
}

export function MensajeError({ titulo = 'No se pudo cargar', mensaje, reintentar }: { titulo?: string; mensaje: string; reintentar?: () => void }) {
  return (
    <div className="estado estado-error" role="alert">
      <p className="estado-titulo">{titulo}</p>
      <p>{mensaje}</p>
      {reintentar && (
        <button type="button" className="boton boton-secundario" onClick={reintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

// Aviso breve dentro de un formulario (error de la API o confirmación).
export function Aviso({ tipo, children }: { tipo: 'error' | 'ok'; children: ReactNode }) {
  return (
    <p className={`aviso aviso-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
