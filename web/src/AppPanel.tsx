// Rutas del panel. La tienda es otra compilación: sus pantallas no entran a este paquete.
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Cargando } from './componentes/Estados';
import { NoEncontrada } from './componentes/NoEncontrada';
import { Login } from './paginas/Login';
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

// El dashboard trae Chart.js: se descarga solo cuando se abre.
const Dashboard = lazy(() => import('./panel/Dashboard').then((m) => ({ default: m.Dashboard })));

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RutaProtegida />}>
        <Route path="/panel" element={<PanelLayout />}>
          <Route index element={<PanelInicio />} />
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="pedidos/:id" element={<PedidoPanel />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="inventario/:id" element={<Kardex />} />
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
          <Route path="*" element={<NoEncontrada enPanel />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/panel" replace />} />
    </Routes>
  );
}
