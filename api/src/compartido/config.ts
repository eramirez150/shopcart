import { existsSync } from 'node:fs';

// Carga .env si existe (Node 24 lo hace sin dependencias). En Docker las variables vienen del entorno.
if (existsSync('.env')) process.loadEnvFile('.env');

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

const secreto = requerida('JWT_SECRET');
if (secreto.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres');

// Las pruebas locales con LocalDB usan TEST_DB_CONNECTION_STRING y no necesitan usuario ni clave.
const conCadenaDePruebas = Boolean(process.env.TEST_DB_CONNECTION_STRING);

export const config = {
  // Cada servicio define su puerto por defecto; PORT lo reemplaza.
  puerto: (porDefecto: number) => Number(process.env.PORT ?? porDefecto),
  corsOrigenes: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
  jwt: {
    secreto,
    accesoMinutos: Number(process.env.JWT_ACCESS_MINUTES ?? 15),
    refreshDias: Number(process.env.JWT_REFRESH_DAYS ?? 7),
  },
  db: {
    servidor: process.env.DB_HOST ?? '127.0.0.1',
    puerto: Number(process.env.DB_PORT ?? 14335),
    nombre: process.env.DB_NAME ?? 'ShopCart',
    // La API se conecta con el usuario de aplicación, que solo tiene EXECUTE.
    usuario: conCadenaDePruebas ? '' : requerida('DB_USER'),
    clave: conCadenaDePruebas ? '' : requerida('DB_PASSWORD'),
  },
};
