import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

// Las pruebas con base de datos exigen una base ShopCart recién creada con todos los scripts de
// database/ (00_base a 06_permisos, como los aplica database/aplicar.sh) y una conexión:
// TEST_DB_CONNECTION_STRING (LocalDB con msnodesqlv8) o DB_USER y DB_PASSWORD.
export const hayBase = Boolean(process.env.TEST_DB_CONNECTION_STRING || process.env.DB_PASSWORD);

export const SECRETO = (process.env.JWT_SECRET ??= 'secreto-solo-para-pruebas-0123456789abcdef');
process.env.DB_USER ??= 'sin-uso';
process.env.DB_PASSWORD ??= 'sin-uso';

export interface Respuesta {
  estado: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  datos: any;
}

interface Opciones {
  cuerpo?: unknown;
  token?: string;
  cabeceras?: Record<string, string>;
}

async function escuchar(servidor: Server): Promise<string> {
  await once(servidor, 'listening');
  return `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;
}

// Levanta los dos servicios en puertos libres, sobre la misma base.
export async function iniciarServidor() {
  const { crearAppTienda } = await import('../src/tienda/app.js');
  const { crearAppAdmin } = await import('../src/admin/app.js');
  const { cerrarPool } = await import('../src/compartido/db.js');
  const servidorTienda = crearAppTienda().listen(0, '127.0.0.1');
  const servidorAdmin = crearAppAdmin().listen(0, '127.0.0.1');
  const [base, baseAdmin] = await Promise.all([escuchar(servidorTienda), escuchar(servidorAdmin)]);

  const pedirEn = (raiz: string) => async (metodo: string, ruta: string, opciones: Opciones = {}): Promise<Respuesta> => {
    const r = await fetch(raiz + ruta, {
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
  };

  const tienda = pedirEn(base);
  const admin = pedirEn(baseAdmin);
  // El prefijo de la ruta decide el servicio; tienda() y admin() fuerzan uno para probar los cruces.
  const pedir = (metodo: string, ruta: string, opciones: Opciones = {}) =>
    (ruta.startsWith('/admin') ? admin : tienda)(metodo, ruta, opciones);

  async function login(correo: string, clave: string): Promise<string> {
    const r = await pedir('POST', '/publico/auth/login', { cuerpo: { correo, clave } });
    if (r.estado !== 200) throw new Error(`login ${correo}: ${r.estado}`);
    return r.datos.accessToken as string;
  }

  // Cliente nuevo con sesión, para pruebas que necesitan muchos usuarios.
  async function registrar(prefijo: string): Promise<{ token: string; id: number }> {
    const correo = `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@shopcart.test`;
    const r = await pedir('POST', '/publico/auth/registro', { cuerpo: { correo, clave: 'Prueba-123456', nombre: 'Prueba ' + prefijo } });
    if (r.estado !== 201) throw new Error(`registro: ${r.estado} ${JSON.stringify(r.datos)}`);
    return { token: r.datos.accessToken as string, id: r.datos.usuario.id as number };
  }

  async function cerrar() {
    for (const servidor of [servidorTienda, servidorAdmin]) {
      servidor.close();
      servidor.closeAllConnections();
    }
    await cerrarPool();
  }

  const expirado = (id: number, rol: string) => jwt.sign({ rol }, SECRETO, { subject: String(id), expiresIn: -10 });

  return { base, baseAdmin, pedir, tienda, admin, login, registrar, cerrar, expirado };
}

export const direccion = { direccion: '6a avenida 12-34 zona 1', ciudad: 'Guatemala', telefono: '55551234' };
