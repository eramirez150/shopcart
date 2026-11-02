// Rutas de la tienda. El panel es otra compilación: sus pantallas no entran a este paquete.
import { Route, Routes } from 'react-router';
import { NoEncontrada } from './componentes/NoEncontrada';
import { Cuenta } from './cuenta/Cuenta';
import { MiPedido } from './cuenta/MiPedido';
import { MisDirecciones } from './cuenta/MisDirecciones';
import { MisPedidos } from './cuenta/MisPedidos';
import { Login } from './paginas/Login';
import { Registro } from './paginas/Registro';
import { RutaProtegida } from './sesion/RutaProtegida';
import { Buscar } from './tienda/Buscar';
import { ProveedorCarrito } from './tienda/CarritoContexto';
import { CarritoPagina } from './tienda/CarritoPagina';
import { Categorias } from './tienda/Categorias';
import { Checkout, PedidoConfirmado } from './tienda/Checkout';
import { Detalle } from './tienda/Detalle';
import { Inicio } from './tienda/Inicio';
import { TiendaLayout } from './tienda/TiendaLayout';

export function App() {
  return (
    <ProveedorCarrito>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />

        <Route element={<TiendaLayout />}>
          <Route index element={<Inicio />} />
          <Route path="buscar" element={<Buscar />} />
          <Route path="categorias" element={<Categorias />} />
          <Route path="producto/:id" element={<Detalle />} />
          <Route path="carrito" element={<CarritoPagina />} />
          <Route element={<RutaProtegida />}>
            <Route path="checkout" element={<Checkout />} />
            <Route path="checkout/listo/:id" element={<PedidoConfirmado />} />
            <Route path="cuenta" element={<Cuenta />} />
            <Route path="cuenta/pedidos" element={<MisPedidos />} />
            <Route path="cuenta/pedidos/:id" element={<MiPedido />} />
            <Route path="cuenta/direcciones" element={<MisDirecciones />} />
          </Route>
          <Route path="*" element={<NoEncontrada />} />
        </Route>
      </Routes>
    </ProveedorCarrito>
  );
}
