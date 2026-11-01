// Rutas de la aplicación. Las secciones privadas pasan por RutaProtegida con los roles permitidos.
import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router';
import { Cargando, Vacio } from './componentes/Estados';
import { Cuenta } from './cuenta/Cuenta';
import { MiPedido } from './cuenta/MiPedido';
import { MisDirecciones } from './cuenta/MisDirecciones';
import { MisPedidos } from './cuenta/MisPedidos';
import { Login } from './paginas/Login';
import { Registro } from './paginas/Registro';
import { Bitacora } from './panel/Bitacora';
import { CategoriasPanel } from './panel/Categorias';
import { Cupones } from './panel/Cupones';
import { Inventario } from './panel/Inventario';
import { Kardex } from './panel/Kardex';
import { PanelInicio, PanelLayout } from './panel/PanelLayout';
import { PedidoPanel } from './panel/PedidoPanel';
import { Pedidos } from './panel/Pedidos';
import { ProductoEditar } from './panel/ProductoEditar';
import { Productos } from './panel/Productos';
import { Usuarios } from './panel/Usuarios';
import { RutaProtegida } from './sesion/RutaProtegida';
import { Buscar } from './tienda/Buscar';
import { CarritoPagina } from './tienda/CarritoPagina';
import { Categorias } from './tienda/Categorias';
import { Checkout, PedidoConfirmado } from './tienda/Checkout';
import { Detalle } from './tienda/Detalle';
import { Inicio } from './tienda/Inicio';
import { TiendaLayout } from './tienda/TiendaLayout';

// El dashboard trae Chart.js: se descarga solo cuando el administrador lo abre.
const Dashboard = lazy(() => import('./panel/Dashboard').then((m) => ({ default: m.Dashboard })));

function NoEncontrada() {
  return (
    <main className="contenedor">
      <Vacio titulo="Esta página no existe" ilustracion="busqueda">
        <Link to="/" className="boton boton-principal">
          Ir al inicio
        </Link>
      </Vacio>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />

      <Route element={<TiendaLayout />}>
        <Route index element={<Inicio />} />
        <Route path="buscar" element={<Buscar />} />
        <Route path="categorias" element={<Categorias />} />
        <Route path="producto/:id" element={<Detalle />} />
        <Route path="carrito" element={<CarritoPagina />} />
        <Route element={<RutaProtegida roles={['Cliente']} />}>
          <Route path="checkout" element={<Checkout />} />
          <Route path="checkout/listo/:id" element={<PedidoConfirmado />} />
          <Route path="cuenta" element={<Cuenta />} />
          <Route path="cuenta/pedidos" element={<MisPedidos />} />
          <Route path="cuenta/pedidos/:id" element={<MiPedido />} />
          <Route path="cuenta/direcciones" element={<MisDirecciones />} />
        </Route>
        <Route path="*" element={<NoEncontrada />} />
      </Route>

      <Route element={<RutaProtegida roles={['Operador', 'Administrador']} />}>
        <Route path="/panel" element={<PanelLayout />}>
          <Route index element={<PanelInicio />} />
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="pedidos/:id" element={<PedidoPanel />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="inventario/:id" element={<Kardex />} />
          <Route element={<RutaProtegida roles={['Administrador']} />}>
            <Route
              path="dashboard"
              element={
                <Suspense fallback={<Cargando />}>
                  <Dashboard />
                </Suspense>
              }
            />
            <Route path="categorias" element={<CategoriasPanel />} />
            <Route path="productos" element={<Productos />} />
            <Route path="productos/:id" element={<ProductoEditar />} />
            <Route path="cupones" element={<Cupones />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="bitacora" element={<Bitacora />} />
          </Route>
          <Route path="*" element={<NoEncontrada />} />
        </Route>
      </Route>
    </Routes>
  );
}
