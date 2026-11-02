import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ProveedorSesion } from './sesion/SesionContexto';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './estilos.css';

// VITE_APP se fija al compilar: la aplicación que no se elige no entra al paquete.
const aplicacion = import.meta.env.VITE_APP === 'admin' ? import('./AppPanel') : import('./AppTienda');

void aplicacion.then(({ App }) => {
  createRoot(document.getElementById('raiz')!).render(
    <StrictMode>
      <BrowserRouter>
        <ProveedorSesion>
          <App />
        </ProveedorSesion>
      </BrowserRouter>
    </StrictMode>,
  );
});
