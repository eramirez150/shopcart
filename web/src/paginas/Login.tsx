// Inicio de sesión. En la tienda entra el cliente, con su carrito de invitado fusionado;
// en el panel entra el personal. Cada uno usa el login de su servicio.
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { ES_PANEL, mensajeDe } from '../api/cliente';
import { Campo } from '../componentes/Campo';
import { Aviso } from '../componentes/Estados';
import { INICIO, useSesion } from '../sesion/SesionContexto';
import { correo as validarCorreo, requerido, sinErrores } from '../validacion';

const MODO_DEMO = import.meta.env.VITE_MODO_DEMO === 'true';

// Cuentas creadas por database/02_semillas; solo se muestran en modo demostración.
const CUENTAS_DEMO = ES_PANEL
  ? [
      { etiqueta: 'Entrar como operador', correo: 'operador@shopcart.test', clave: 'Operador123!' },
      { etiqueta: 'Entrar como administrador', correo: 'admin@shopcart.test', clave: 'Admin123!' },
    ]
  : [{ etiqueta: 'Entrar como cliente', correo: 'cliente@shopcart.test', clave: 'Cliente123!' }];

// Solo se respeta "volver" si es una ruta de esta aplicación.
export function destinoTrasEntrar(volver: string | null): string {
  const local = volver?.startsWith('/') && !volver.startsWith('//');
  return local && volver!.startsWith('/panel') === ES_PANEL ? volver! : INICIO;
}

export function Login() {
  const { usuario, iniciarSesion } = useSesion();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const volver = params.get('volver');
  const [datos, setDatos] = useState({ correo: '', clave: '' });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorApi, setErrorApi] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario && !enviando) return <Navigate to={INICIO} replace />;

  async function entrar(correo: string, clave: string) {
    setEnviando(true);
    setErrorApi('');
    try {
      await iniciarSesion(correo, clave);
      navegar(destinoTrasEntrar(volver), { replace: true });
    } catch (e) {
      setErrorApi(mensajeDe(e));
      setEnviando(false);
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const encontrados = sinErrores({ correo: validarCorreo(datos.correo), clave: requerido(datos.clave, 'Escribe tu contraseña.') });
    setErrores(encontrados ?? {});
    if (!encontrados) void entrar(datos.correo.trim(), datos.clave);
  }

  return (
    <main className="pantalla-acceso">
      <form className="tarjeta-acceso" onSubmit={enviar} noValidate>
        <Link to="/" className="marca marca-grande">
          ShopCart
        </Link>
        <h1>Iniciar sesión</h1>
        <Campo
          etiqueta="Correo"
          name="correo"
          type="email"
          autoComplete="email"
          value={datos.correo}
          error={errores.correo}
          onChange={(e) => setDatos({ ...datos, correo: e.target.value })}
        />
        <Campo
          etiqueta="Contraseña"
          name="clave"
          type="password"
          autoComplete="current-password"
          value={datos.clave}
          error={errores.clave}
          onChange={(e) => setDatos({ ...datos, clave: e.target.value })}
        />
        {errorApi && <Aviso tipo="error">{errorApi}</Aviso>}
        <button type="submit" className="boton boton-principal boton-ancho" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        {!ES_PANEL && (
          <p className="texto-centro">
            ¿No tienes cuenta? <Link to={`/registro${volver ? `?volver=${encodeURIComponent(volver)}` : ''}`}>Crear cuenta</Link>
          </p>
        )}
        {MODO_DEMO && (
          <div className="demo">
            <p>Modo demostración</p>
            {CUENTAS_DEMO.map((c) => (
              <button key={c.correo} type="button" className="boton boton-secundario boton-ancho" disabled={enviando} onClick={() => void entrar(c.correo, c.clave)}>
                {c.etiqueta}
              </button>
            ))}
          </div>
        )}
      </form>
    </main>
  );
}
