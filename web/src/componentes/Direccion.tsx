// Campos y validación de una dirección de entrega (checkout y Mi cuenta).
import { maximo, requerido, sinErrores } from '../validacion';
import { Campo } from './Campo';

export interface DatosDireccion {
  direccion: string;
  ciudad: string;
  telefono: string;
}

export function validarDireccion(d: DatosDireccion) {
  return sinErrores({
    direccion: requerido(d.direccion, 'Escribe la dirección.') ?? maximo(d.direccion, 300),
    ciudad: requerido(d.ciudad, 'Escribe la ciudad.') ?? maximo(d.ciudad, 100),
    telefono: requerido(d.telefono, 'Escribe un teléfono.') ?? (/^[0-9 +()-]{8,20}$/.test(d.telefono.trim()) ? undefined : 'Escribe un teléfono de 8 a 20 dígitos.'),
  });
}

export function CamposDireccion({ datos, errores, cambiar }: { datos: DatosDireccion; errores: Record<string, string>; cambiar: (d: DatosDireccion) => void }) {
  return (
    <>
      <Campo etiqueta="Dirección" name="direccion" autoComplete="street-address" value={datos.direccion} error={errores.direccion} onChange={(e) => cambiar({ ...datos, direccion: e.target.value })} />
      <Campo etiqueta="Ciudad" name="ciudad" autoComplete="address-level2" value={datos.ciudad} error={errores.ciudad} onChange={(e) => cambiar({ ...datos, ciudad: e.target.value })} />
      <Campo etiqueta="Teléfono" name="telefono" type="tel" autoComplete="tel" value={datos.telefono} error={errores.telefono} onChange={(e) => cambiar({ ...datos, telefono: e.target.value })} />
    </>
  );
}
