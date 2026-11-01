// Registro de clientes. Al terminar, la sesión queda abierta y el carrito de invitado se conserva.
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { ErrorApi, mensajeDe } from '../api/cliente';
import { Campo } from '../componentes/Campo';
import { Aviso } from '../componentes/Estados';
import { inicioDeRol, useSesion } from '../sesion/SesionContexto';
import { claveNueva, correo as validarCorreo, maximo, requerido, sinErrores } from '../validacion';
import { destinoTrasEntrar } from './Login';

export function Registro() {
  const { usuario, registrar } = useSesion();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const [datos, setDatos] = useState({ nombre: '', correo: '', clave: '', confirmacion: '' });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorApi, setErrorApi] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario && !enviando) return <Navigate to={inicioDeRol(usuario.rol)} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const encontrados = sinErrores({
      nombre: requerido(datos.nombre, 'Escribe tu nombre.') ?? maximo(datos.nombre, 100),
      correo: validarCorreo(datos.correo),
      clave: claveNueva(datos.clave),
      confirmacion: datos.confirmacion === datos.clave ? undefined : 'Las contraseñas no coinciden.',
    });
    setErrores(encontrados ?? {});
    if (encontrados) return;
    setEnviando(true);
    setErrorApi('');
    try {
      const u = await registrar(datos.nombre.trim(), datos.correo.trim(), datos.clave);
      navegar(destinoTrasEntrar(u, params.get('volver')), { replace: true });
    } catch (err) {
      if (err instanceof ErrorApi) setErrores(err.campos());
      setErrorApi(mensajeDe(err));
      setEnviando(false);
    }
  }

  const campo = (nombre: keyof typeof datos) => ({
    name: nombre,
    value: datos[nombre],
    error: errores[nombre],
    onChange: (e: { target: { value: string } }) => setDatos({ ...datos, [nombre]: e.target.value }),
  });

  return (
    <main className="pantalla-acceso">
      <form className="tarjeta-acceso" onSubmit={enviar} noValidate>
        <Link to="/" className="marca marca-grande">
          ShopCart
        </Link>
        <h1>Crear cuenta</h1>
        <Campo etiqueta="Nombre" autoComplete="name" {...campo('nombre')} />
        <Campo etiqueta="Correo" type="email" autoComplete="email" {...campo('correo')} />
        <Campo etiqueta="Contraseña" type="password" autoComplete="new-password" ayuda="Al menos 8 caracteres." {...campo('clave')} />
        <Campo etiqueta="Repite la contraseña" type="password" autoComplete="new-password" {...campo('confirmacion')} />
        {errorApi && <Aviso tipo="error">{errorApi}</Aviso>}
        <button type="submit" className="boton boton-principal boton-ancho" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
        <p className="texto-centro">
          ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
        </p>
      </form>
    </main>
  );
}
