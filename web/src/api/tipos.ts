// Tipos de las respuestas de la API, tomados de api/openapi.yaml.

export type Rol = 'Cliente' | 'Operador' | 'Administrador';

export type EstadoPedido = 'Pagado' | 'EnPreparacion' | 'Despachado' | 'Entregado' | 'DevueltoParcial' | 'Devuelto' | 'Cancelado';

export const ESTADOS_PEDIDO: EstadoPedido[] = ['Pagado', 'EnPreparacion', 'Despachado', 'Entregado', 'DevueltoParcial', 'Devuelto', 'Cancelado'];

export interface Usuario {
  id: number;
  correo: string;
  nombre: string;
  rol: Rol;
}

export interface Sesion {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  usuario: Usuario;
}

export interface Pagina<T> {
  total: number;
  pagina: number;
  tamano: number;
  datos: T[];
}

export interface Categoria {
  IDCategoria: number;
  Nombre: string;
  Descripcion: string | null;
  Activa: boolean;
}

export interface ProductoResumen {
  IDProducto: number;
  Nombre: string;
  Descripcion?: string | null;
  IDCategoria: number;
  Categoria: string;
  PrecioDesde: number;
  PrecioHasta: number;
  Disponible: number;
  Variantes: number;
  ImagenPrincipal: string | null;
}

export type Atributos = Record<string, string>;

export interface Variante {
  IDVariante: number;
  SKU: string;
  Atributos: Atributos;
  Precio: number;
  Activa: boolean;
  Existencia: number;
  Reservado: number;
  Disponible: number;
}

export interface Imagen {
  IDProductoImagen: number;
  Url: string;
  TextoAlternativo: string | null;
  Orden: number;
}

export interface Producto {
  IDProducto: number;
  Nombre: string;
  Descripcion: string | null;
  IDCategoria: number;
  Categoria: string;
  Activo: boolean;
  variantes: Variante[];
  imagenes: Imagen[];
}

export interface ProductoAdministracion {
  IDProducto: number;
  Nombre: string;
  IDCategoria: number;
  Categoria: string;
  CategoriaActiva: boolean;
  Activo: boolean;
  FechaCreacion: string;
  Variantes: number;
  VariantesActivas: number;
  PrecioDesde: number | null;
  PrecioHasta: number | null;
  Existencia: number;
  Disponible: number;
  ImagenPrincipal: string | null;
}

export interface LineaCarrito {
  IDVariante: number;
  SKU: string;
  Producto: string;
  Atributos: Atributos;
  Cantidad: number;
  PrecioUnitario: number;
  Subtotal: number;
  Descuento: number;
  Total: number;
  Disponible: number;
}

export interface Carrito {
  IDCarrito: number | null;
  TokenInvitado: string | null;
  Cupon: string | null;
  Subtotal: number;
  Descuento: number;
  Total: number;
  lineas: LineaCarrito[];
}

export interface Direccion {
  IDDireccion: number;
  Direccion: string;
  Ciudad: string;
  Telefono: string;
  Activa: boolean;
  FechaCreacion: string;
}

export interface Reserva {
  IDReserva: number;
  Estado: 'Activa' | 'Consumida' | 'Anulada';
  Expira: string;
  Vencida: boolean;
  Cupon: string | null;
  Subtotal: number;
  Descuento: number;
  Total: number;
  IDDireccion: number;
  Direccion: string;
  Ciudad: string;
  Telefono: string;
  lineas: { IDVariante: number; SKU: string; Producto: string; Cantidad: number; PrecioUnitario: number; Descuento: number }[];
}

export interface PedidoResumen {
  IDPedido: number;
  IDUsuario: number;
  Cliente: string;
  Estado: EstadoPedido;
  Subtotal: number;
  Descuento: number;
  Total: number;
  FechaCreacion: string;
}

export interface LineaPedido {
  IDPedidoDetalle: number;
  IDVariante: number;
  SKU: string;
  Producto: string;
  Cantidad: number;
  PrecioUnitario: number;
  Descuento: number;
  CantidadDevuelta: number;
}

export interface Pedido extends PedidoResumen {
  Cupon: string | null;
  IVA: number;
  IDDireccion: number | null;
  Direccion: string;
  Ciudad: string;
  Telefono: string;
  ReferenciaPago: string;
  lineas: LineaPedido[];
  historial: { EstadoAnterior: EstadoPedido | null; EstadoNuevo: EstadoPedido; IDUsuario: number; Usuario: string; Comentario: string | null; Fecha: string }[];
}

export interface Devolucion {
  IDDevolucion: number;
  IDPedido: number;
  IDUsuario: number;
  Motivo: string;
  Monto: number;
  Fecha?: string;
  lineas: { IDDevolucion: number; IDPedidoDetalle: number; SKU: string; Cantidad: number; Monto: number }[];
}

export interface Existencia {
  IDVariante: number;
  SKU: string;
  Producto: string;
  Atributos: string;
  Existencia: number;
  Reservado: number;
  Disponible: number;
}

export interface MovimientoKardex {
  IDKardex: number;
  IDVariante: number;
  Tipo: 'Entrada' | 'Salida' | 'Ajuste' | 'Devolucion' | string;
  Cantidad: number;
  ExistenciaResultante: number;
  Motivo: string;
  IDUsuario: number;
  Usuario: string;
  IDPedido: number | null;
  Fecha: string;
}

export interface Cupon {
  IDCupon: number;
  Codigo: string;
  Tipo: 'Porcentaje' | 'Monto';
  Valor: number;
  FechaInicio: string;
  FechaFin: string;
  MinimoCompra: number;
  LimiteTotal: number | null;
  LimitePorCliente: number | null;
  Usos: number;
  IDCategoria: number | null;
  Activo: boolean;
}

export interface UsuarioAdmin {
  IDUsuario: number;
  Correo: string;
  Nombre: string;
  Rol: Rol;
  Activo: boolean;
}

export interface RegistroBitacora {
  IDBitacora: number;
  Fecha: string;
  IDUsuario: number | null;
  Usuario: string | null;
  Modulo: string;
  Entidad: string;
  IDEntidad: number;
  Accion: string;
  ValorAnterior: string | null;
  ValorNuevo: string | null;
}
