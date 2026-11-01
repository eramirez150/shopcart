import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

// Las pruebas con base de datos exigen una base ShopCart recién creada con los scripts 001 a 012
// y una conexión: TEST_DB_CONNECTION_STRING (LocalDB con msnodesqlv8) o DB_USER y DB_PASSWORD.
export const hayBase = Boolean(process.env.TEST_DB_CONNECTION_STRING || process.env.DB_PASSWORD);

export const SECRETO = (process.env.JWT_SECRET ??= 'secreto-solo-para-pruebas-0123456789abcdef');
process.env.DB_USER ??= 'sin-uso';
process.env.DB_PASSWORD ??= 'sin-uso';

export interface Respuesta {
  estado: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  datos: any;
}

export async function iniciarServidor() {
  const { crearApp } = await import('../src/app.js');
  const { cerrarPool } = await import('../src/db.js');
  const servidor = crearApp().listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;

  async function pedir(
    metodo: string,
    ruta: string,
    opciones: { cuerpo?: unknown; token?: string; cabeceras?: Record<string, string> } = {},
  ): Promise<Respuesta> {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: {
        ...(opciones.cuerpo !== undefined && { 'content-type': 'application/json' }),
        ...(opciones.token && { authorization: `Bearer ${opciones.token}` }),
        ...opciones.cabeceras,
      },
      ...(opciones.cuerpo !== undefined && { body: JSON.stringify(opciones.cuerpo) }),
    });
    const texto = await r.text();
    return { estado: r.status, datos: texto ? JSON.parse(texto) : null };
  }

  async function login(correo: string, clave: string): Promise<string> {
    const r = await pedir('POST', '/auth/login', { cuerpo: { correo, clave } });
    if (r.estado !== 200) throw new Error(`login ${correo}: ${r.estado}`);
    return r.datos.accessToken as string;
  }

  // Cliente nuevo con sesión, para pruebas que necesitan muchos usuarios.
  async function registrar(prefijo: string): Promise<{ token: string; id: number }> {
    const correo = `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@shopcart.test`;
    const r = await pedir('POST', '/auth/registro', { cuerpo: { correo, clave: 'Prueba-123456', nombre: 'Prueba ' + prefijo } });
    if (r.estado !== 201) throw new Error(`registro: ${r.estado} ${JSON.stringify(r.datos)}`);
    return { token: r.datos.accessToken as string, id: r.datos.usuario.id as number };
  }

  async function cerrar() {
    servidor.close();
    servidor.closeAllConnections();
    await cerrarPool();
  }

  const expirado = (id: number, rol: string) => jwt.sign({ rol }, SECRETO, { subject: String(id), expiresIn: -10 });

  return { base, pedir, login, registrar, cerrar, expirado };
}

export const direccion = { direccion: '6a avenida 12-34 zona 1', ciudad: 'Guatemala', telefono: '55551234' };
