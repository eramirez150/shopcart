// Estados comunes: carga (barra fina o esqueletos con la forma del contenido),
// vacío con ilustración y error con opción de reintentar.
import type { ReactNode } from 'react';
import { Ilustracion, type NombreIlustracion } from './Ilustraciones';

export function Cargando({ texto = 'Cargando' }: { texto?: string }) {
  return (
    <div className="cargando" role="status" aria-live="polite">
      <span className="cargando-barra" aria-hidden="true" />
      <span className="oculto-visual">{texto}</span>
    </div>
  );
}

// Esqueletos: ocupan el mismo lugar que el contenido real, así la página no salta al cargar.
export function EsqueletoGrilla({ cantidad = 6 }: { cantidad?: number }) {
  return (
    <div className="grilla-productos" role="status" aria-label="Cargando productos">
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="tarjeta esqueleto-tarjeta" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="esqueleto esqueleto-foto" />
          <div className="esqueleto esqueleto-linea" />
          <div className="esqueleto esqueleto-linea corta" />
        </div>
      ))}
    </div>
  );
}

export function EsqueletoFilas({ filas = 6 }: { filas?: number }) {
  return (
    <div className="esqueleto-filas" role="status" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="esqueleto esqueleto-fila" style={{ animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  );
}

export function EsqueletoDetalle() {
  return (
    <div className="detalle" role="status" aria-label="Cargando producto">
      <div className="esqueleto detalle-foto" />
      <div className="detalle-info">
        <div className="esqueleto esqueleto-linea" style={{ width: '40%', height: 36 }} />
        <div className="esqueleto esqueleto-linea" style={{ width: '75%', height: 24 }} />
        <div className="esqueleto esqueleto-linea corta" />
      </div>
    </div>
  );
}

export function Vacio({ titulo, ilustracion = 'vacio', children }: { titulo: string; ilustracion?: NombreIlustracion; children?: ReactNode }) {
  return (
    <div className="estado">
      <Ilustracion nombre={ilustracion} />
      <p className="estado-titulo">{titulo}</p>
      {children && <div className="estado-cuerpo">{children}</div>}
    </div>
  );
}

export function MensajeError({ titulo = 'No se pudo cargar', mensaje, reintentar }: { titulo?: string; mensaje: string; reintentar?: () => void }) {
  return (
    <div className="estado estado-error" role="alert">
      <Ilustracion nombre="error" />
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
