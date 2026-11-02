-- Reseñas de prueba para 12 productos con foto. Son datos inventados, solo para que el
-- detalle de producto no salga vacío (el README lo aclara).
--
-- Se escriben directamente porque sus autores no tienen pedidos: así no cambian los
-- pedidos de demostración ni el dashboard. Los autores son clientes desactivados, sin
-- contraseña válida: no pueden iniciar sesión. Ninguna reseña es de los clientes de
-- prueba, para que puedan crear la suya.

------------------------------------------------------------
-- Autores
------------------------------------------------------------
INSERT INTO dbo.Usuarios (Correo, ClaveHash, Nombre, Rol, Activo) VALUES
    (N'resena1@shopcart.test', N'sin-acceso', N'Lucía Morales',   N'Cliente', 0),
    (N'resena2@shopcart.test', N'sin-acceso', N'Diego Herrera',   N'Cliente', 0),
    (N'resena3@shopcart.test', N'sin-acceso', N'Marta Castillo',  N'Cliente', 0),
    (N'resena4@shopcart.test', N'sin-acceso', N'Andrés Paz',      N'Cliente', 0),
    (N'resena5@shopcart.test', N'sin-acceso', N'Sofía Reyes',     N'Cliente', 0),
    (N'resena6@shopcart.test', N'sin-acceso', N'Javier López',    N'Cliente', 0);
GO

------------------------------------------------------------
-- Reseñas
------------------------------------------------------------
INSERT INTO dbo.Resenas (IDProducto, IDUsuario, Calificacion, Comentario, Fecha)
SELECT p.IDProducto, u.IDUsuario, r.Calificacion, r.Comentario, DATEADD(DAY, -r.DiasAtras, SYSUTCDATETIME())
FROM (VALUES
    (N'Audífonos inalámbricos', 1, 5, N'Se escuchan muy bien y la batería dura varios días de uso normal.', 6),
    (N'Audífonos inalámbricos', 2, 4, N'Buen sonido por el precio. El estuche es un poco grande para el bolsillo.', 19),
    (N'Audífonos inalámbricos', 3, 5, N'Se conectan rápido al teléfono y son cómodos durante horas.', 33),
    (N'Audífonos inalámbricos', 4, 3, N'Cumplen, aunque en lugares con mucho ruido se quedan cortos.', 47),

    (N'Bocina portátil', 2, 5, N'Suena fuerte para su tamaño. La usamos en el patio sin problema.', 11),
    (N'Bocina portátil', 5, 4, N'Resistió la lluvia en un paseo. Los bajos podrían ser mejores.', 28),
    (N'Bocina portátil', 6, 4, N'Buena relación entre calidad y precio.', 52),

    (N'Batería externa', 1, 5, N'Carga el teléfono casi tres veces. Muy práctica para viajar.', 9),
    (N'Batería externa', 4, 4, N'Pesa un poco, pero rinde lo que promete.', 40),

    (N'Reloj inteligente', 3, 4, N'El conteo de pasos es confiable y la pantalla se ve bien al sol.', 15),
    (N'Reloj inteligente', 5, 3, N'Funciona bien, pero la batería dura menos de lo que esperaba.', 26),
    (N'Reloj inteligente', 6, 5, N'Liviano y cómodo. Lo uso todos los días para hacer ejercicio.', 58),

    (N'Laptop 14 pulgadas', 1, 5, N'Rápida para trabajar y estudiar. Enciende en segundos.', 13),
    (N'Laptop 14 pulgadas', 2, 4, N'Muy buena para oficina. Para juegos pesados no alcanza.', 31),
    (N'Laptop 14 pulgadas', 6, 4, N'Pantalla clara y teclado cómodo. El ventilador se oye a veces.', 44),

    (N'Mouse inalámbrico', 3, 5, N'Preciso y silencioso. Las pilas duran bastante.', 7),
    (N'Mouse inalámbrico', 4, 4, N'Buen tamaño para mano mediana.', 36),

    (N'Licuadora', 1, 4, N'Tritura hielo sin esfuerzo. El vaso de vidrio se limpia fácil.', 17),
    (N'Licuadora', 3, 5, N'Potente y estable sobre la mesa. La usamos a diario.', 29),
    (N'Licuadora', 5, 3, N'Hace bastante ruido, pero el resultado es bueno.', 63),

    (N'Sartén antiadherente', 2, 5, N'Nada se pega y calienta parejo.', 12),
    (N'Sartén antiadherente', 4, 4, N'Muy buena para el precio. Conviene usar utensilios de madera.', 41),

    (N'Tenis para correr', 1, 5, N'Livianos y con buena amortiguación. Ideales para distancias largas.', 8),
    (N'Tenis para correr', 2, 4, N'Cómodos desde el primer día. Quedan un poco ajustados.', 22),
    (N'Tenis para correr', 5, 4, N'Buen agarre en pista mojada.', 37),
    (N'Tenis para correr', 6, 5, N'Los uso para caminar y para correr, y siguen como nuevos.', 55),

    (N'Tapete de yoga', 3, 5, N'No se resbala y tiene buen grosor para las rodillas.', 10),
    (N'Tapete de yoga', 5, 4, N'Al principio tiene algo de olor, pero se quita en unos días.', 34),

    (N'Playera básica', 1, 4, N'Tela suave y buena caída. Conserva la forma después de lavarla.', 16),
    (N'Playera básica', 4, 3, N'Correcta para diario, aunque la talla viene algo grande.', 30),
    (N'Playera básica', 6, 5, N'Compré una y volví por otra. Muy cómoda.', 49),

    (N'Bloques de construcción', 2, 5, N'Mis hijos juegan con ellos todas las tardes. Las piezas encajan bien.', 14),
    (N'Bloques de construcción', 3, 5, N'Buen regalo. Vienen muchas piezas de colores variados.', 27),
    (N'Bloques de construcción', 5, 4, N'Divertidos, aunque habría sido útil una caja para guardarlos.', 60)
) AS r (Producto, Autor, Calificacion, Comentario, DiasAtras)
JOIN dbo.Productos p ON p.Nombre = r.Producto
JOIN dbo.Usuarios u ON u.Correo = N'resena' + CAST(r.Autor AS NVARCHAR(2)) + N'@shopcart.test';

IF (SELECT COUNT(*) FROM dbo.Resenas) <> 34
    THROW 50000, N'Las semillas de reseñas no encontraron todos sus productos o autores.', 1;
GO
