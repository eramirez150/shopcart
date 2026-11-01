// Rutas de la aplicación. Las secciones privadas pasan por RutaProtegida con los roles permitidos.
import { Route, Routes } from 'react-router';
import { Vacio } from './componentes/Estados';
import { PanelInicio, PanelLayout } from './panel/PanelLayout';
import { Login } from './paginas/Login';
import { Registro } from './paginas/Registro';
import { RutaProtegida } from './sesion/RutaProtegida';
import { Link } from 'react-router';

function NoEncontrada() {
  return (
    <main className="contenedor">
      <Vacio titulo="Esta página no existe">
        <Link to="/" className="boton boton-principal">
          Ir al inicio
        </Link>
      </Vacio>
    </main>
  );
}

function InicioTemporal() {
  return (
    <main className="contenedor">
      <h1>ShopCart</h1>
      <Link to="/login">Iniciar sesión</Link>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<InicioTemporal />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />

      <Route element={<RutaProtegida roles={['Operador', 'Administrador']} />}>
        <Route path="/panel" element={<PanelLayout />}>
          <Route index element={<PanelInicio />} />
        </Route>
      </Route>

      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  );
}
