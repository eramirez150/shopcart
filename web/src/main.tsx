import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { ProveedorSesion } from './sesion/SesionContexto';
import { ProveedorCarrito } from './tienda/CarritoContexto';
import './estilos.css';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorSesion>
        <ProveedorCarrito>
          <App />
        </ProveedorCarrito>
      </ProveedorSesion>
    </BrowserRouter>
  </StrictMode>,
);
