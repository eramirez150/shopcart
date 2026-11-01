// Campo de formulario con etiqueta y mensaje de error.
import type { InputHTMLAttributes, ReactNode } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  error?: string | undefined;
  ayuda?: ReactNode;
}

export function Campo({ etiqueta, error, ayuda, id, ...resto }: Props) {
  const idCampo = id ?? resto.name;
  return (
    <div className="campo">
      <label htmlFor={idCampo}>{etiqueta}</label>
      <input id={idCampo} aria-invalid={error ? true : undefined} aria-describedby={error ? `${idCampo}-error` : undefined} {...resto} />
      {ayuda && !error && <small className="campo-ayuda">{ayuda}</small>}
      {error && (
        <small id={`${idCampo}-error`} className="campo-error">
          {error}
        </small>
      )}
    </div>
  );
}
