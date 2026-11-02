// Tarjeta de producto y cuadrícula. El botón redondo agrega directo si el producto
// tiene una sola variante disponible; si tiene varias, abre el detalle para elegir.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, mensajeDe } from '../api/cliente';
import type { Producto, ProductoResumen } from '../api/tipos';
import { SinFoto } from '../componentes/Ilustraciones';
import { Precio } from '../componentes/Precio';
import { useCarrito } from './CarritoContexto';
import { Icono } from './Iconos';

function Estrellas({ valor, ventas }: { valor: number; ventas: number | null | undefined }) {
  const llenas = Math.round(Math.min(5, Math.max(0, valor)));
  return (
    <p className="tarjeta-estrellas" aria-label={`${valor.toFixed(1)} de 5 estrellas`}>
      <span aria-hidden="true">{'★'.repeat(llenas) + '☆'.repeat(5 - llenas)}</span>
      {ventas != null && <span> · {ventas} vendidos</span>}
    </p>
  );
}

export function TarjetaProducto({ producto }: { producto: ProductoResumen }) {
  const { agregar } = useCarrito();
  const navegar = useNavigate();
  const [estado, setEstado] = useState<'' | 'agregando' | 'agregado'>('');
  const [error, setError] = useState('');
  const agotado = producto.Disponible <= 0;
  const detalle = `/producto/${producto.IDProducto}`;

  async function agregarRapido() {
    if (estado === 'agregando') return;
    if (producto.Variantes !== 1) {
      navegar(detalle);
      return;
    }
    setEstado('agregando');
    setError('');
    try {
      const p = await api<Producto>(`/productos/${producto.IDProducto}`);
      const variante = p.variantes.find((v) => v.Activa && v.Disponible > 0);
      if (!variante) throw new Error('Producto agotado.');
      await agregar(variante.IDVariante, 1);
      setEstado('agregado');
      setTimeout(() => setEstado(''), 1500);
    } catch (e) {
      setError(mensajeDe(e));
      setEstado('');
    }
  }

  return (
    <article className={`tarjeta ${agotado ? 'tarjeta-sin-existencia' : ''}`}>
      <Link to={detalle} className="tarjeta-enlace">
        <div className="tarjeta-foto">
          {producto.ImagenPrincipal ? <img src={producto.ImagenPrincipal} alt={producto.Nombre} loading="lazy" /> : <SinFoto categoria={producto.Categoria} />}
        </div>
        <h3 className="tarjeta-nombre">{producto.Nombre}</h3>
        {producto.Calificacion != null && <Estrellas valor={producto.Calificacion} ventas={producto.Ventas} />}
        <p className="tarjeta-precios">
          {producto.PrecioHasta > producto.PrecioDesde && <span className="precio-desde">desde</span>}
          <Precio valor={producto.PrecioDesde} />
          {producto.PrecioAnterior != null && producto.PrecioAnterior > producto.PrecioDesde && <Precio valor={producto.PrecioAnterior} tamano="chico" tachado />}
        </p>
        {agotado && <p className="tarjeta-agotado">Agotado</p>}
      </Link>
      <button
        type="button"
        className={`tarjeta-agregar ${estado}`}
        aria-label={producto.Variantes === 1 ? `Agregar ${producto.Nombre} al carrito` : `Elegir opciones de ${producto.Nombre}`}
        disabled={agotado || estado === 'agregando'}
        onClick={() => void agregarRapido()}
      >
        <Icono key={estado} nombre={estado === 'agregado' ? 'listo' : 'mas'} />
      </button>
      {error && (
        <p className="tarjeta-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

export function GrillaProductos({ productos }: { productos: ProductoResumen[] }) {
  return (
    <div className="grilla-productos">
      {productos.map((p) => (
        <TarjetaProducto key={p.IDProducto} producto={p} />
      ))}
    </div>
  );
}
