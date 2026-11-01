import { Router } from 'express';
import { z } from 'zod';
import { autenticar, autenticarOpcional, autorizar, idUsuario } from '../../middleware/auth.js';
import { dinero, id, paginacion } from '../../compartido/esquemas.js';
import * as servicio from './service.js';

export const rutasCategorias = Router();
export const rutasProductos = Router();

const admin = [autenticar, autorizar('Administrador')];
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

// ---- Categorías
rutasCategorias.get('/', autenticarOpcional, async (req, res) => {
  const q = z.object({ incluirInactivas: bool.default(false) }).parse(req.query);
  res.json(await servicio.listarCategorias(q.incluirInactivas && servicio.veInactivos(req.usuario?.rol)));
});

const categoria = z.object({
  nombre: z.string().trim().min(1).max(80),
  descripcion: z.string().trim().max(300).nullish(),
});

rutasCategorias.post('/', ...admin, async (req, res) => {
  const b = categoria.parse(req.body);
  res.status(201).json(await servicio.crearCategoria(idUsuario(req), b.nombre, b.descripcion ?? null));
});

rutasCategorias.put('/:id', ...admin, async (req, res) => {
  const b = categoria.extend({ activa: z.boolean().default(true) }).parse(req.body);
  res.json(await servicio.actualizarCategoria(idUsuario(req), id.parse(req.params.id), b.nombre, b.descripcion ?? null, b.activa));
});

rutasCategorias.delete('/:id', ...admin, async (req, res) => {
  res.json(await servicio.eliminarCategoria(idUsuario(req), id.parse(req.params.id)));
});

// ---- Productos
rutasProductos.get('/', async (req, res) => {
  const q = z
    .object({
      texto: z.string().trim().max(100).optional(),
      idCategoria: id.optional(),
      precioMin: z.coerce.number().min(0).optional(),
      precioMax: z.coerce.number().min(0).optional(),
      soloDisponibles: bool.default(false),
      orden: z.enum(['nombre', 'precio_asc', 'precio_desc', 'recientes']).default('nombre'),
      ...paginacion,
    })
    .parse(req.query);
  res.json(await servicio.buscar(q));
});

rutasProductos.get('/:id', autenticarOpcional, async (req, res) => {
  res.json(await servicio.obtenerProducto(id.parse(req.params.id), servicio.veInactivos(req.usuario?.rol)));
});

const producto = z.object({
  idCategoria: id,
  nombre: z.string().trim().min(1).max(150),
  descripcion: z.string().trim().max(1000).nullish(),
});

rutasProductos.post('/', ...admin, async (req, res) => {
  const b = producto.parse(req.body);
  res.status(201).json(await servicio.crearProducto(idUsuario(req), b.idCategoria, b.nombre, b.descripcion ?? null));
});

rutasProductos.put('/:id', ...admin, async (req, res) => {
  const b = producto.extend({ activo: z.boolean().default(true) }).parse(req.body);
  res.json(
    await servicio.actualizarProducto(idUsuario(req), id.parse(req.params.id), b.idCategoria, b.nombre, b.descripcion ?? null, b.activo),
  );
});

// Con ventas o movimientos se desactiva; si nunca se usó, se elimina.
rutasProductos.delete('/:id', ...admin, async (req, res) => {
  res.json(await servicio.eliminarProducto(idUsuario(req), id.parse(req.params.id)));
});

const variante = z.object({
  sku: z.string().trim().min(1).max(40),
  atributos: z.record(z.string(), z.string()).default({}),
  precio: dinero,
});

rutasProductos.post('/:id/variantes', ...admin, async (req, res) => {
  const b = variante.extend({ existenciaInicial: z.number().int().min(0).default(0) }).parse(req.body);
  res
    .status(201)
    .json(await servicio.crearVariante(idUsuario(req), id.parse(req.params.id), b.sku, b.atributos, b.precio, b.existenciaInicial));
});

rutasProductos.put('/variantes/:idVariante', ...admin, async (req, res) => {
  const b = variante.extend({ activa: z.boolean().default(true) }).parse(req.body);
  res.json(await servicio.actualizarVariante(idUsuario(req), id.parse(req.params.idVariante), b.sku, b.atributos, b.precio, b.activa));
});
