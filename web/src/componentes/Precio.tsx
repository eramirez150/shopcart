// Precio con jerarquía: la "Q" y los centavos más pequeños que los quetzales enteros.
// Las cifras son tabulares para que los montos se alineen en listas y tablas.
interface Props {
  valor: number;
  tamano?: 'chico' | 'mediano' | 'grande';
  tachado?: boolean;
}

export function Precio({ valor, tamano = 'mediano', tachado = false }: Props) {
  const [entero = '0', centavos = '00'] = Math.abs(valor).toFixed(2).split('.');
  const contenido = (
    <>
      {valor < 0 && '−'}
      <span className="precio-moneda">Q</span>
      {Number(entero).toLocaleString('es-GT')}
      <span className="precio-centavos">.{centavos}</span>
    </>
  );
  return tachado ? <s className={`precio precio-${tamano} precio-tachado`}>{contenido}</s> : <span className={`precio precio-${tamano}`}>{contenido}</span>;
}
