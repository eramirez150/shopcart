import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { hayBase, iniciarServidor } from './ayuda.js';

// Roles y permisos administrables. Cada prueba crea sus propios roles y usuarios.
describe('roles y permisos', { skip: !hayBase && 'sin conexión a la base' }, () => {
  let s: Awaited<ReturnType<typeof iniciarServidor>>;
  let admin = '', operador = '';
  before(async () => {
    s = await iniciarServidor();
    admin = await s.loginAdmin('admin@shopcart.test', 'Admin123!');
    operador = await s.loginAdmin('operador@shopcart.test', 'Operador123!');
  });
  after(async () => {
    await s.cerrar();
  });

  const marca = () => `${Date.now() % 1000000000}${Math.floor(Math.random() * 1000)}`;

  async function crearRol(permisos: string[]) {
    const r = await s.admin('POST', '/admin/roles', { token: admin, cuerpo: { nombre: 'R' + marca(), descripcion: 'Rol de prueba', permisos } });
    assert.equal(r.estado, 201, JSON.stringify(r.datos));
    return r.datos as { IDRol: number; Nombre: string; permisos: string[] };
  }

  async function crearUsuario(rol: string) {
    const correo = `rol-${marca()}@shopcart.test`;
    const r = await s.admin('POST', '/admin/usuarios', { token: admin, cuerpo: { correo, clave: 'Prueba-123456', nombre: 'Prueba rol', rol } });
    assert.equal(r.estado, 201, JSON.stringify(r.datos));
    return { id: r.datos.IDUsuario as number, correo, token: await s.loginAdmin(correo, 'Prueba-123456') };
  }

  const estado = async (metodo: string, ruta: string, token: string, cuerpo?: unknown) =>
    (await s.admin(metodo, ruta, { token, ...(cuerpo !== undefined && { cuerpo }) })).estado;

  const fijarPermisos = (rol: { IDRol: number; Nombre: string }, permisos: string[]) =>
    s.admin('PUT', `/admin/roles/${rol.IDRol}`, { token: admin, cuerpo: { nombre: rol.Nombre, permisos } });

  test('catálogo de permisos: solo el Administrador lo consulta y roles.gestionar no es asignable', async () => {
    const r = await s.admin('GET', '/admin/permisos', { token: admin });
    assert.equal(r.estado, 200);
    const codigos = r.datos.map((p: { Codigo: string }) => p.Codigo);
    for (const c of ['pedidos.ver', 'pedidos.gestionar', 'inventario.ver', 'inventario.gestionar', 'catalogo.gestionar', 'cupones.gestionar', 'usuarios.gestionar', 'reportes.ver', 'bitacora.ver', 'roles.gestionar']) {
      assert.ok(codigos.includes(c), c);
    }
    assert.equal(r.datos.find((p: { Codigo: string }) => p.Codigo === 'roles.gestionar').Asignable, false);
    assert.equal(await estado('GET', '/admin/permisos', operador), 403);
    assert.equal(await estado('GET', '/admin/roles', operador), 403);
    assert.equal(await estado('POST', '/admin/roles', operador, { nombre: 'x', permisos: [] }), 403);
  });

  test('el Operador conserva exactamente el acceso de hoy', async () => {
    const roles = await s.admin('GET', '/admin/roles', { token: admin });
    const rol = roles.datos.find((r: { Nombre: string }) => r.Nombre === 'Operador');
    assert.deepEqual([...rol.permisos].sort(), ['inventario.gestionar', 'inventario.ver', 'pedidos.gestionar', 'pedidos.ver']);

    for (const ruta of ['/admin/pedidos', '/admin/inventario/existencias']) assert.equal(await estado('GET', ruta, operador), 200, ruta);
    for (const ruta of ['/admin/usuarios', '/admin/cupones', '/admin/productos', '/admin/categorias', '/admin/dashboard/indicadores', '/admin/bitacora']) {
      assert.equal(await estado('GET', ruta, operador), 403, ruta);
    }
  });

  test('el Administrador tiene todos los permisos y el Cliente ninguno', async () => {
    const roles = await s.admin('GET', '/admin/roles', { token: admin });
    const permisos = (nombre: string) => roles.datos.find((r: { Nombre: string }) => r.Nombre === nombre).permisos as string[];
    assert.ok(permisos('Administrador').includes('roles.gestionar'));
    assert.ok(permisos('Administrador').includes('bitacora.ver'));
    assert.deepEqual(permisos('Cliente'), []);
  });

  test('un rol personalizado solo entra a lo que dicen sus permisos', async () => {
    const rol = await crearRol(['cupones.gestionar']);
    assert.deepEqual(rol.permisos, ['cupones.gestionar']);
    const u = await crearUsuario(rol.Nombre);

    assert.equal(await estado('GET', '/admin/cupones', u.token), 200);
    for (const ruta of ['/admin/pedidos', '/admin/inventario/existencias', '/admin/usuarios', '/admin/productos', '/admin/bitacora', '/admin/roles']) {
      assert.equal(await estado('GET', ruta, u.token), 403, ruta);
    }

    // Su cuenta entra por administración, no por la tienda.
    const tienda = await s.tienda('POST', '/publico/auth/login', { cuerpo: { correo: u.correo, clave: 'Prueba-123456' } });
    assert.equal(tienda.estado, 401);
  });

  test('gestionar incluye ver, pero ver no permite gestionar', async () => {
    const gestiona = await crearUsuario((await crearRol(['pedidos.gestionar', 'inventario.gestionar'])).Nombre);
    assert.equal(await estado('GET', '/admin/pedidos', gestiona.token), 200);
    assert.equal(await estado('GET', '/admin/inventario/existencias', gestiona.token), 200);

    const mira = await crearUsuario((await crearRol(['pedidos.ver', 'inventario.ver'])).Nombre);
    assert.equal(await estado('GET', '/admin/pedidos', mira.token), 200);
    assert.equal(await estado('GET', '/admin/inventario/variantes/1/kardex', mira.token), 200);
    assert.equal(await estado('PATCH', '/admin/pedidos/1/estado', mira.token, { estado: 'Cancelado' }), 403);
    assert.equal(await estado('POST', '/admin/pedidos/1/devoluciones', mira.token, { motivo: 'x', lineas: [{ idPedidoDetalle: 1, cantidad: 1 }] }), 403);
    assert.equal(await estado('POST', '/admin/inventario/movimientos', mira.token, { idVariante: 1, tipo: 'Entrada', cantidad: 1, motivo: 'x' }), 403);
  });

  test('quitar un permiso tiene efecto inmediato con el mismo token', async () => {
    const rol = await crearRol(['reportes.ver']);
    const u = await crearUsuario(rol.Nombre);
    assert.equal(await estado('GET', '/admin/dashboard/indicadores', u.token), 200);

    assert.equal((await fijarPermisos(rol, [])).estado, 200);
    assert.equal(await estado('GET', '/admin/dashboard/indicadores', u.token), 403);

    assert.equal((await fijarPermisos(rol, ['reportes.ver'])).estado, 200);
    assert.equal(await estado('GET', '/admin/dashboard/indicadores', u.token), 200);
  });

  test('roles.gestionar no se puede asignar a ningún rol', async () => {
    const r = await s.admin('POST', '/admin/roles', { token: admin, cuerpo: { nombre: 'R' + marca(), permisos: ['roles.gestionar'] } });
    assert.equal(r.estado, 400);

    const rol = await crearRol(['cupones.gestionar']);
    assert.equal((await fijarPermisos(rol, ['cupones.gestionar', 'roles.gestionar'])).estado, 400);
    const actual = await s.admin('GET', `/admin/roles/${rol.IDRol}`, { token: admin });
    assert.deepEqual(actual.datos.permisos, ['cupones.gestionar']);

    const roles = await s.admin('GET', '/admin/roles', { token: admin });
    const op = roles.datos.find((x: { Nombre: string }) => x.Nombre === 'Operador');
    assert.equal((await fijarPermisos(op, [...op.permisos, 'roles.gestionar'])).estado, 400);
    assert.equal((await s.admin('POST', '/admin/roles', { token: admin, cuerpo: { nombre: 'R' + marca(), permisos: ['no.existe'] } })).estado, 400);
  });

  test('los roles de sistema no se editan ni se desactivan; el Operador sí se edita', async () => {
    const roles = await s.admin('GET', '/admin/roles', { token: admin });
    const rol = (nombre: string) => roles.datos.find((r: { Nombre: string }) => r.Nombre === nombre);

    for (const nombre of ['Administrador', 'Cliente']) {
      const r = rol(nombre);
      assert.equal(r.EsSistema, true);
      assert.equal(await estado('PUT', `/admin/roles/${r.IDRol}`, admin, { nombre, permisos: [] }), 409, nombre);
      assert.equal(await estado('PUT', `/admin/roles/${r.IDRol}`, admin, { nombre, activo: false, permisos: [] }), 409, nombre);
    }

    const op = rol('Operador');
    assert.equal(op.EsSistema, false);
    const editado = await fijarPermisos(op, [...op.permisos, 'cupones.gestionar']);
    assert.equal(editado.estado, 200);
    assert.equal(await estado('GET', '/admin/cupones', operador), 200);
    assert.equal((await fijarPermisos(op, op.permisos)).estado, 200);
    assert.equal(await estado('GET', '/admin/cupones', operador), 403);
  });

  test('un rol con usuarios activos no se desactiva y uno inactivo no se asigna', async () => {
    const rol = await crearRol(['cupones.gestionar']);
    const u = await crearUsuario(rol.Nombre);
    const desactivar = () => s.admin('PUT', `/admin/roles/${rol.IDRol}`, { token: admin, cuerpo: { nombre: rol.Nombre, activo: false, permisos: rol.permisos } });

    assert.equal((await desactivar()).estado, 409);

    assert.equal(await estado('PATCH', `/admin/usuarios/${u.id}`, admin, { activo: false }), 200);
    const inactivo = await desactivar();
    assert.equal(inactivo.estado, 200);
    assert.equal(inactivo.datos.Activo, false);

    const correo = `rol-${marca()}@shopcart.test`;
    const nuevo = { correo, clave: 'Prueba-123456', nombre: 'Sin rol', rol: rol.Nombre };
    assert.equal(await estado('POST', '/admin/usuarios', admin, nuevo), 400);
    assert.equal(await estado('POST', '/admin/usuarios', admin, { ...nuevo, rol: 'NoExiste' }), 400);
    assert.equal(await estado('PATCH', `/admin/usuarios/${u.id}`, admin, { rol: 'NoExiste' }), 400);
    assert.equal(await estado('PATCH', '/admin/usuarios/2', admin, { rol: rol.Nombre }), 400);
    // Reactivar al usuario dejaría una cuenta con un rol inactivo.
    assert.equal(await estado('PATCH', `/admin/usuarios/${u.id}`, admin, { activo: true }), 409);
  });

  test('el nombre del rol no distingue mayúsculas: se guarda el nombre exacto y no se duplica', async () => {
    const correo = `rol-${marca()}@shopcart.test`;
    const r = await s.admin('POST', '/admin/usuarios', { token: admin, cuerpo: { correo, clave: 'Prueba-123456', nombre: 'Minúsculas', rol: 'cliente' } });
    assert.equal(r.datos.Rol, 'Cliente');
    assert.equal((await s.admin('POST', '/admin/auth/login', { cuerpo: { correo, clave: 'Prueba-123456' } })).estado, 401);
    assert.equal(await estado('POST', '/admin/roles', admin, { nombre: 'cliente', permisos: [] }), 409);
  });

  test('un rol se puede renombrar y sus usuarios lo conservan', async () => {
    const rol = await crearRol(['cupones.gestionar']);
    const u = await crearUsuario(rol.Nombre);
    const nombre = 'N' + marca();
    assert.equal((await s.admin('PUT', `/admin/roles/${rol.IDRol}`, { token: admin, cuerpo: { nombre, permisos: rol.permisos } })).estado, 200);
    const lista = await s.admin('GET', `/admin/usuarios?rol=${nombre}`, { token: admin });
    assert.deepEqual(lista.datos.datos.map((x: { IDUsuario: number }) => x.IDUsuario), [u.id]);
    assert.equal(await estado('GET', '/admin/cupones', u.token), 200);
  });

  test('nadie cambia su propio rol ni se desactiva', async () => {
    assert.equal(await estado('PATCH', '/admin/usuarios/1', admin, { rol: 'Operador' }), 409);
    assert.equal(await estado('PATCH', '/admin/usuarios/1', admin, { activo: false }), 409);

    const rol = await crearRol(['usuarios.gestionar']);
    const otro = await crearRol(['cupones.gestionar']);
    const u = await crearUsuario(rol.Nombre);
    assert.equal(await estado('PATCH', `/admin/usuarios/${u.id}`, u.token, { rol: otro.Nombre }), 409);
    assert.equal(await estado('PATCH', `/admin/usuarios/${u.id}`, u.token, { rol: 'Administrador' }), 409);
    assert.equal(await estado('PATCH', `/admin/usuarios/${u.id}`, u.token, { activo: false }), 409);
  });

  test('con usuarios.gestionar no se asignan roles de empleado ni se toca a un administrador', async () => {
    const u = await crearUsuario((await crearRol(['usuarios.gestionar'])).Nombre);
    const colega = await crearUsuario((await crearRol(['cupones.gestionar'])).Nombre);
    const correo = `rol-${marca()}@shopcart.test`;

    assert.equal(await estado('POST', '/admin/usuarios', u.token, { correo, clave: 'Prueba-123456', nombre: 'Falso', rol: 'Administrador' }), 403);
    assert.equal(await estado('PATCH', `/admin/usuarios/${colega.id}`, u.token, { rol: 'Administrador' }), 403);
    assert.equal(await estado('PATCH', '/admin/usuarios/1', u.token, { activo: false }), 403);
    assert.equal(await estado('PATCH', '/admin/usuarios/1', u.token, { rol: 'Operador' }), 403);
    // Con un rol fuerte y una clave elegida por él podría entrar con más permisos que los suyos.
    assert.equal(await estado('POST', '/admin/usuarios', u.token, { correo, clave: 'Prueba-123456', nombre: 'Falso', rol: 'Operador' }), 403);
    assert.equal(await estado('PATCH', `/admin/usuarios/${colega.id}`, u.token, { rol: 'Operador' }), 403);

    // Fuera de eso sí gestiona usuarios.
    assert.equal(await estado('GET', '/admin/usuarios', u.token), 200);
    assert.equal(await estado('POST', '/admin/usuarios', u.token, { correo, clave: 'Prueba-123456', nombre: 'Bueno', rol: 'Cliente' }), 201);
    assert.equal(await estado('PATCH', `/admin/usuarios/${colega.id}`, u.token, { activo: false }), 200);
  });

  test('cambiar el rol de un usuario cierra sus sesiones', async () => {
    const c = await s.tienda('POST', '/publico/auth/registro', {
      cuerpo: { correo: `rol-${marca()}@shopcart.test`, clave: 'Prueba-123456', nombre: 'Asciende' },
    });
    assert.equal(await estado('PATCH', `/admin/usuarios/${c.datos.usuario.id}`, admin, { rol: 'Operador' }), 200);
    const r = await s.tienda('POST', '/publico/auth/refresh', { cuerpo: { refreshToken: c.datos.refreshToken } });
    assert.equal(r.estado, 401);
  });

  test('roles, permisos y asignaciones quedan en la bitácora con valor anterior y nuevo', async () => {
    const rol = await crearRol(['cupones.gestionar']);
    const u = await crearUsuario(rol.Nombre);
    await s.admin('PUT', `/admin/roles/${rol.IDRol}`, { token: admin, cuerpo: { nombre: rol.Nombre, descripcion: 'Cambiada', permisos: ['reportes.ver'] } });
    const roles = await s.admin('GET', '/admin/roles', { token: admin });
    const destino = roles.datos.find((r: { Nombre: string }) => r.Nombre === 'Operador').Nombre as string;
    assert.equal(await estado('PATCH', `/admin/usuarios/${u.id}`, admin, { rol: destino }), 200);

    const bit = await s.admin('GET', '/admin/bitacora?modulo=Roles&tamano=100', { token: admin });
    assert.equal(bit.estado, 200);
    interface Fila { Entidad: string; IDEntidad: number; Accion: string; IDUsuario: number; ValorAnterior: string | null; ValorNuevo: string | null }
    const filas = bit.datos.datos as Fila[];

    const delRol = filas.filter((f) => f.Entidad === 'Rol' && f.IDEntidad === rol.IDRol);
    assert.equal(delRol.find((f) => f.Accion === 'Creacion')!.ValorAnterior, null);
    const cambio = delRol.find((f) => f.Accion === 'Modificacion')!;
    assert.equal(JSON.parse(cambio.ValorAnterior!).Descripcion, 'Rol de prueba');
    assert.equal(JSON.parse(cambio.ValorNuevo!).Descripcion, 'Cambiada');
    assert.equal(cambio.IDUsuario, 1);

    const permisos = filas.filter((f) => f.Entidad === 'RolPermiso' && f.IDEntidad === rol.IDRol);
    assert.equal(JSON.parse(permisos.find((f) => f.Accion === 'Eliminacion')!.ValorAnterior!).Permiso, 'cupones.gestionar');
    assert.ok(permisos.some((f) => f.Accion === 'Creacion' && JSON.parse(f.ValorNuevo!).Permiso === 'reportes.ver'));

    const asignacion = filas.find((f) => f.Entidad === 'Usuario' && f.IDEntidad === u.id)!;
    assert.equal(JSON.parse(asignacion.ValorAnterior!).Rol, rol.Nombre);
    assert.equal(JSON.parse(asignacion.ValorNuevo!).Rol, 'Operador');
  });
});
