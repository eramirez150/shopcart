// Controles de página para los listados paginados en el servidor.
interface Props {
  pagina: number;
  tamano: number;
  total: number;
  cambiar: (pagina: number) => void;
}

export function Paginacion({ pagina, tamano, total, cambiar }: Props) {
  const paginas = Math.max(1, Math.ceil(total / tamano));
  if (total === 0) return null;
  const desde = (pagina - 1) * tamano + 1;
  const hasta = Math.min(total, pagina * tamano);
  return (
    <nav className="paginacion" aria-label="Paginación">
      <span>
        {desde}–{hasta} de {total}
      </span>
      <div>
        <button type="button" className="boton boton-secundario" disabled={pagina <= 1} onClick={() => cambiar(pagina - 1)}>
          Anterior
        </button>
        <span className="paginacion-actual">
          Página {pagina} de {paginas}
        </span>
        <button type="button" className="boton boton-secundario" disabled={pagina >= paginas} onClick={() => cambiar(pagina + 1)}>
          Siguiente
        </button>
      </div>
    </nav>
  );
}
