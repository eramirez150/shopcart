// Productos relacionados del detalle. Son un extra: si fallan o no hay, la sección no aparece.
import { api } from '../api/cliente';
import type { ProductoResumen } from '../api/tipos';
import { useApi } from '../api/useApi';
import { EsqueletoGrilla } from '../componentes/Estados';
import { GrillaProductos } from './TarjetaProducto';

export function Relacionados({ idProducto }: { idProducto: number }) {
  const r = useApi(() => api<ProductoResumen[]>(`/publico/productos/${idProducto}/relacionados`), String(idProducto));
  if (r.error || r.datos?.length === 0) return null;
  return (
    <section className="seccion" aria-labelledby="relacionados-titulo">
      <div className="seccion-cabeza">
        <h2 id="relacionados-titulo">También te puede interesar</h2>
      </div>
      {r.datos ? <GrillaProductos productos={r.datos} /> : <EsqueletoGrilla />}
    </section>
  );
}
