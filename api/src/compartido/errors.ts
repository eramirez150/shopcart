import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
    public readonly codigo = 'ERROR',
    public readonly detalle?: unknown,
  ) {
    super(mensaje);
  }
}

// Los SP lanzan THROW 52000 + código HTTP (52404 -> 404). Ver la sección de scripts del README.
export function traducir(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (e instanceof ZodError) {
    return new AppError(
      400,
      'Datos inválidos',
      'VALIDACION',
      e.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    );
  }
  const numero = (e as { number?: number }).number;
  if (numero !== undefined && numero >= 52400 && numero <= 52499) {
    return new AppError(numero - 52000, (e as Error).message, 'NEGOCIO');
  }
  if (numero === 2601 || numero === 2627) return new AppError(409, 'El registro ya existe', 'DUPLICADO');
  if (numero === 1205) return new AppError(409, 'Conflicto de concurrencia, intente de nuevo', 'CONCURRENCIA');
  if (e instanceof SyntaxError && 'body' in e) return new AppError(400, 'JSON inválido', 'JSON');
  return new AppError(500, 'Error interno', 'INTERNO');
}
