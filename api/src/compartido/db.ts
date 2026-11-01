import mssql from 'mssql';
import { config } from './config.js';

// Solo para pruebas locales: TEST_DB_CONNECTION_STRING usa el controlador msnodesqlv8
// (LocalDB solo habla por canal con nombre). En producción siempre se usa tedious.
const cadenaPruebas = process.env.TEST_DB_CONNECTION_STRING;
const moduloPruebas = 'mssql/msnodesqlv8'; // nombre en variable: el paquete nativo no es dependencia
export const sql: typeof mssql = cadenaPruebas
  ? ((await import(moduloPruebas)) as { default: typeof mssql }).default
  : mssql;

let pool: Promise<mssql.ConnectionPool> | undefined;

function obtenerPool(): Promise<mssql.ConnectionPool> {
  pool ??= new sql.ConnectionPool(
    (cadenaPruebas
      ? { connectionString: cadenaPruebas, pool: { max: 30 } }
      : {
          server: config.db.servidor,
          port: config.db.puerto,
          database: config.db.nombre,
          user: config.db.usuario,
          password: config.db.clave,
          options: { encrypt: true, trustServerCertificate: true },
          pool: { max: 20 },
        }) as mssql.config,
  )
    .connect()
    .catch((e) => {
      pool = undefined;
      throw e;
    });
  return pool;
}

export async function cerrarPool(): Promise<void> {
  if (pool) await (await pool).close();
  pool = undefined;
}

export type Entradas = Record<string, [tipo: unknown, valor: unknown]>;
export type Resultado = unknown[][];

// Único punto de acceso a datos: ejecuta un stored procedure con parámetros tipados.
// Ante un interbloqueo (error 1205) reintenta hasta dos veces.
export async function ejecutar(sp: string, entradas: Entradas = {}): Promise<Resultado> {
  for (let intento = 1; ; intento++) {
    try {
      const request = (await obtenerPool()).request();
      for (const [nombre, [tipo, valor]] of Object.entries(entradas)) {
        request.input(nombre, tipo as mssql.ISqlType, valor);
      }
      const r = await request.execute(sp);
      return r.recordsets as unknown as Resultado;
    } catch (e) {
      if ((e as { number?: number }).number === 1205 && intento < 3) continue;
      throw e;
    }
  }
}

export function filas<T>(r: Resultado, indice = 0): T[] {
  return (r[indice] ?? []) as T[];
}

export function primera<T>(r: Resultado, indice = 0): T | undefined {
  return filas<T>(r, indice)[0];
}

// Separa la columna TotalFilas de los listados paginados.
export function pagina<T extends { TotalFilas?: number }>(r: Resultado, numero: number, tamano: number) {
  const datos = filas<T>(r);
  return {
    total: datos[0]?.TotalFilas ?? 0,
    pagina: numero,
    tamano,
    datos: datos.map(({ TotalFilas: _t, ...resto }) => resto),
  };
}
