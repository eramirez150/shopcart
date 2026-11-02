import { Router } from 'express';
import { z } from 'zod';
import { autenticar, autorizar, idUsuario } from '../../middleware/auth.js';
import { booleano, dinero, id, MAX_INT, paginacion } from '../../compartido/esquemas.js';
import * as servicio from '../../modules/catalogo/service.js';

export const rutasCategorias = Router();
export const rutasProductos = Router();

rutasCategorias.use(autenticar('admin'), autorizar('catalogo.gestionar'));
rutasProductos.use(autenticar('admin'), autorizar('catalogo.gestionar'));

// ---- Categorías
rutasCategorias.get('/', async (req, res) => {
  const q = z.object({ incluirInactivas: booleano.default(false) }).parse(req.query);
  res.json(await servicio.listarCategorias(q.incluirInactivas));
});

const categoria = z.object({
  nombre: z.string().trim().min(1).max(80),
  descripcion: z.string().trim().max(300).nullish(),
});

rutasCategorias.post('/', async (req, res) => {
  const b = categoria.parse(req.body);
  res.status(201).json(await servicio.crearCategoria(idUsuario(req), b.nombre, b.descripcion ?? null));
});

rutasCategorias.put('/:id', async (req, res) => {
  const b = categoria.extend({ activa: z.boolean().default(true) }).parse(req.body);
  res.json(await servicio.actualizarCategoria(idUsuario(req), id.parse(req.params.id), b.nombre, b.descripcion ?? null, b.activa));
});

rutasCategorias.delete('/:id', async (req, res) => {
  res.json(await servicio.eliminarCategoria(idUsuario(req), id.parse(req.params.id)));
});

// ---- Productos
// Catálogo de administración: incluye inactivos y productos sin variantes.
rutasProductos.get('/', async (req, res) => {
  const q = z
    .object({
      texto: z.string().trim().min(1).max(100).optional(),
      idCategoria: id.optional(),
      activo: booleano.optional(),
      orden: z.enum(['nombre', 'recientes']).default('nombre'),
      ...paginacion,
    })
    .parse(req.query);
  res.json(await servicio.listarAdministracion(idUsuario(req), q));
});

rutasProductos.get('/:id', async (req, res) => {
  res.json(await servicio.obtenerProducto(id.parse(req.params.id), true));
});

const producto = z.object({
  idCategoria: id,
  nombre: z.string().trim().min(1).max(150),
  descripcion: z.string().trim().max(1000).nullish(),
});

rutasProductos.post('/', async (req, res) => {
  const b = producto.parse(req.body);
  res.status(201).json(await servicio.crearProducto(idUsuario(req), b.idCategoria, b.nombre, b.descripcion ?? null));
});

rutasProductos.put('/:id', async (req, res) => {
  const b = producto.extend({ activo: z.boolean().default(true) }).parse(req.body);
  res.json(
    await servicio.actualizarProducto(idUsuario(req), id.parse(req.params.id), b.idCategoria, b.nombre, b.descripcion ?? null, b.activo),
  );
});

// Con ventas o movimientos se desactiva; si nunca se usó, se elimina.
rutasProductos.delete('/:id', async (req, res) => {
  res.json(await servicio.eliminarProducto(idUsuario(req), id.parse(req.params.id)));
});

const variante = z.object({
  sku: z.string().trim().min(1).max(40),
  atributos: z.record(z.string(), z.string()).default({}),
  precio: dinero,
});

rutasProductos.post('/:id/variantes', async (req, res) => {
  const b = variante.extend({ existenciaInicial: z.number().int().min(0).max(MAX_INT).default(0) }).parse(req.body);
  res
    .status(201)
    .json(await servicio.crearVariante(idUsuario(req), id.parse(req.params.id), b.sku, b.atributos, b.precio, b.existenciaInicial));
});

rutasProductos.put('/variantes/:idVariante', async (req, res) => {
  const b = variante.extend({ activa: z.boolean().default(true) }).parse(req.body);
  res.json(await servicio.actualizarVariante(idUsuario(req), id.parse(req.params.idVariante), b.sku, b.atributos, b.precio, b.activa));
});

// ---- Imágenes de producto
rutasProductos.post('/:id/imagenes', async (req, res) => {
  const b = z
    .object({
      url: z.url({ protocol: /^https?$/ }).max(500),
      textoAlternativo: z.string().trim().max(150).nullish(),
      orden: z.number().int().min(0).max(MAX_INT).default(0),
    })
    .parse(req.body);
  res
    .status(201)
    .json(await servicio.agregarImagen(idUsuario(req), id.parse(req.params.id), b.url, b.textoAlternativo ?? null, b.orden));
});

rutasProductos.delete('/imagenes/:idImagen', async (req, res) => {
  res.json(await servicio.eliminarImagen(idUsuario(req), id.parse(req.params.idImagen)));
});
