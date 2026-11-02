import { ejecutar, filas, pagina, primera, sql, type Resultado } from '../../compartido/db.js';

export interface FiltrosBusqueda {
  texto?: string;
  idCategoria?: number;
  precioMin?: number;
  precioMax?: number;
  soloDisponibles: boolean;
  orden: string;
  pagina: number;
  tamano: number;
}

export async function listarCategorias(incluirInactivas: boolean) {
  return filas(await ejecutar('SP_Categorias_Listar', { IncluirInactivas: [sql.Bit, incluirInactivas] }));
}

export async function crearCategoria(idUsuario: number, nombre: string, descripcion: string | null) {
  const r = await ejecutar('SP_Categorias_Crear', {
    IDUsuario: [sql.Int, idUsuario],
    Nombre: [sql.NVarChar(80), nombre],
    Descripcion: [sql.NVarChar(300), descripcion],
  });
  return primera(r);
}

export async function actualizarCategoria(idUsuario: number, id: number, nombre: string, descripcion: string | null, activa: boolean) {
  const r = await ejecutar('SP_Categorias_Actualizar', {
    IDUsuario: [sql.Int, idUsuario],
    IDCategoria: [sql.Int, id],
    Nombre: [sql.NVarChar(80), nombre],
    Descripcion: [sql.NVarChar(300), descripcion],
    Activa: [sql.Bit, activa],
  });
  return primera(r);
}

export async function eliminarCategoria(idUsuario: number, id: number) {
  const r = await ejecutar('SP_Categorias_Eliminar', { IDUsuario: [sql.Int, idUsuario], IDCategoria: [sql.Int, id] });
  return primera<{ Resultado: string }>(r)!;
}

export async function buscarProductos(f: FiltrosBusqueda) {
  const r = await ejecutar('SP_Catalogo_BuscarProductos', {
    Texto: [sql.NVarChar(100), f.texto ?? null],
    IDCategoria: [sql.Int, f.idCategoria ?? null],
    PrecioMin: [sql.Decimal(12, 2), f.precioMin ?? null],
    PrecioMax: [sql.Decimal(12, 2), f.precioMax ?? null],
    SoloDisponibles: [sql.Bit, f.soloDisponibles],
    Orden: [sql.NVarChar(20), f.orden],
    Pagina: [sql.Int, f.pagina],
    Tamano: [sql.Int, f.tamano],
  });
  return pagina(r, f.pagina, f.tamano);
}

export interface FiltrosAdministracion {
  texto?: string;
  idCategoria?: number;
  activo?: boolean;
  orden: string;
  pagina: number;
  tamano: number;
}

// Incluye productos inactivos y sin variantes (solo Administrador).
export async function listarAdministracion(idUsuario: number, f: FiltrosAdministracion) {
  const r = await ejecutar('SP_Catalogo_ListarAdministracion', {
    IDUsuario: [sql.Int, idUsuario],
    Texto: [sql.NVarChar(100), f.texto ?? null],
    IDCategoria: [sql.Int, f.idCategoria ?? null],
    Activo: [sql.Bit, f.activo ?? null],
    Orden: [sql.NVarChar(20), f.orden],
    Pagina: [sql.Int, f.pagina],
    Tamano: [sql.Int, f.tamano],
  });
  return pagina(r, f.pagina, f.tamano);
}

// Los atributos se guardan como texto JSON; la API los devuelve como objeto.
function producto(r: Resultado) {
  return {
    ...primera<object>(r)!,
    variantes: filas<{ Atributos: string }>(r, 1).map((v) => ({ ...v, Atributos: JSON.parse(v.Atributos) as unknown })),
    imagenes: filas(r, 2),
  };
}

export async function obtenerProducto(id: number, incluirInactivos: boolean) {
  return producto(
    await ejecutar('SP_Catalogo_ObtenerProducto', { IDProducto: [sql.Int, id], IncluirInactivos: [sql.Bit, incluirInactivos] }),
  );
}

export async function obtenerRelacionados(id: number, incluirInactivos: boolean) {
  return filas(await ejecutar('SP_Catalogo_ObtenerRelacionados', { IDProducto: [sql.Int, id], IncluirInactivos: [sql.Bit, incluirInactivos] }));
}

export async function crearProducto(idUsuario: number, idCategoria: number, nombre: string, descripcion: string | null) {
  return producto(
    await ejecutar('SP_Catalogo_CrearProducto', {
      IDUsuario: [sql.Int, idUsuario],
      IDCategoria: [sql.Int, idCategoria],
      Nombre: [sql.NVarChar(150), nombre],
      Descripcion: [sql.NVarChar(1000), descripcion],
    }),
  );
}

export async function actualizarProducto(
  idUsuario: number, id: number, idCategoria: number, nombre: string, descripcion: string | null, activo: boolean,
) {
  return producto(
    await ejecutar('SP_Catalogo_ActualizarProducto', {
      IDUsuario: [sql.Int, idUsuario],
      IDProducto: [sql.Int, id],
      IDCategoria: [sql.Int, idCategoria],
      Nombre: [sql.NVarChar(150), nombre],
      Descripcion: [sql.NVarChar(1000), descripcion],
      Activo: [sql.Bit, activo],
    }),
  );
}

export async function eliminarProducto(idUsuario: number, id: number) {
  const r = await ejecutar('SP_Catalogo_EliminarProducto', { IDUsuario: [sql.Int, idUsuario], IDProducto: [sql.Int, id] });
  return primera<{ Resultado: string }>(r)!;
}

export async function crearVariante(
  idUsuario: number, idProducto: number, sku: string, atributos: object, precio: number, existenciaInicial: number,
) {
  return producto(
    await ejecutar('SP_Catalogo_CrearVariante', {
      IDUsuario: [sql.Int, idUsuario],
      IDProducto: [sql.Int, idProducto],
      SKU: [sql.NVarChar(40), sku],
      Atributos: [sql.NVarChar(400), JSON.stringify(atributos)],
      Precio: [sql.Decimal(12, 2), precio],
      ExistenciaInicial: [sql.Int, existenciaInicial],
    }),
  );
}

export async function actualizarVariante(
  idUsuario: number, id: number, sku: string, atributos: object, precio: number, activa: boolean,
) {
  return producto(
    await ejecutar('SP_Catalogo_ActualizarVariante', {
      IDUsuario: [sql.Int, idUsuario],
      IDVariante: [sql.Int, id],
      SKU: [sql.NVarChar(40), sku],
      Atributos: [sql.NVarChar(400), JSON.stringify(atributos)],
      Precio: [sql.Decimal(12, 2), precio],
      Activa: [sql.Bit, activa],
    }),
  );
}

export async function agregarImagen(idUsuario: number, idProducto: number, url: string, textoAlternativo: string | null, orden: number) {
  return producto(
    await ejecutar('SP_Catalogo_AgregarImagen', {
      IDUsuario: [sql.Int, idUsuario],
      IDProducto: [sql.Int, idProducto],
      Url: [sql.NVarChar(500), url],
      TextoAlternativo: [sql.NVarChar(150), textoAlternativo],
      Orden: [sql.Int, orden],
    }),
  );
}

export async function eliminarImagen(idUsuario: number, idImagen: number) {
  return producto(
    await ejecutar('SP_Catalogo_EliminarImagen', { IDUsuario: [sql.Int, idUsuario], IDProductoImagen: [sql.Int, idImagen] }),
  );
}
