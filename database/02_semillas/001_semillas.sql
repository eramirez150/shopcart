-- Datos de prueba: usuarios por rol, categorías, 50 productos con variantes,
-- existencia inicial registrada en el kardex y cupones de ejemplo.
-- Las claves de los usuarios están en el README (solo para desarrollo).

------------------------------------------------------------
-- Usuarios (hash bcrypt con costo 10)
------------------------------------------------------------
INSERT INTO dbo.Usuarios (Correo, ClaveHash, Nombre, Rol) VALUES
    (N'admin@shopcart.test',    N'$2b$10$N.a.d3D.hpkXqh.xHlSNTeIVQ9oQSEAuXCq.xCZCZkqgY/p7ak.ku', N'Ana Administradora', N'Administrador'),
    (N'operador@shopcart.test', N'$2b$10$54q1Mn6BkepiuNxT83fSw.8QenjZIh1baYqZ586bU6m7ou3s29nDO', N'Óscar Operador',     N'Operador'),
    (N'cliente@shopcart.test',  N'$2b$10$sLnGOneUZbPXTyaF6nKbdOv/xiw3/y14P3mUtou0XZlztKQDEB8cm', N'Carla Cliente',      N'Cliente'),
    (N'cliente2@shopcart.test', N'$2b$10$sLnGOneUZbPXTyaF6nKbdOv/xiw3/y14P3mUtou0XZlztKQDEB8cm', N'Carlos Cliente',     N'Cliente');
GO

------------------------------------------------------------
-- Categorías
------------------------------------------------------------
INSERT INTO dbo.Categorias (Nombre, Descripcion) VALUES
    (N'Electrónica',  N'Audio, video y accesorios'),
    (N'Computación',  N'Computadoras, periféricos y almacenamiento'),
    (N'Hogar',        N'Muebles, decoración y limpieza'),
    (N'Cocina',       N'Utensilios y electrodomésticos de cocina'),
    (N'Ropa',         N'Ropa para dama y caballero'),
    (N'Calzado',      N'Zapatos y tenis'),
    (N'Deportes',     N'Equipo y accesorios deportivos'),
    (N'Juguetes',     N'Juegos y juguetes para todas las edades');
GO

------------------------------------------------------------
-- Productos
------------------------------------------------------------
INSERT INTO dbo.Productos (IDCategoria, Nombre, Descripcion)
SELECT c.IDCategoria, p.Nombre, p.Descripcion
FROM (VALUES
    (N'Electrónica', N'Audífonos inalámbricos', N'Audífonos Bluetooth con estuche de carga'),
    (N'Electrónica', N'Bocina portátil', N'Bocina Bluetooth resistente al agua'),
    (N'Electrónica', N'Televisor 43 pulgadas', N'Pantalla LED Full HD con funciones inteligentes'),
    (N'Electrónica', N'Cargador rápido USB-C', N'Cargador de pared de 20 W'),
    (N'Electrónica', N'Cámara de seguridad', N'Cámara Wi-Fi para interiores'),
    (N'Electrónica', N'Reloj inteligente', N'Reloj con monitor de ritmo cardiaco'),
    (N'Electrónica', N'Batería externa', N'Batería portátil de 10 000 mAh'),
    (N'Computación', N'Laptop 14 pulgadas', N'Laptop con 8 GB de RAM y SSD'),
    (N'Computación', N'Mouse inalámbrico', N'Mouse óptico de 1600 DPI'),
    (N'Computación', N'Teclado mecánico', N'Teclado mecánico con retroiluminación'),
    (N'Computación', N'Monitor 24 pulgadas', N'Monitor IPS Full HD'),
    (N'Computación', N'Memoria USB', N'Memoria USB 3.0'),
    (N'Computación', N'Disco SSD externo', N'Unidad de estado sólido portátil'),
    (N'Computación', N'Cámara web', N'Cámara web 1080p con micrófono'),
    (N'Hogar', N'Lámpara de escritorio', N'Lámpara LED con brazo ajustable'),
    (N'Hogar', N'Juego de sábanas', N'Sábanas de algodón'),
    (N'Hogar', N'Almohada', N'Almohada de espuma viscoelástica'),
    (N'Hogar', N'Cortina blackout', N'Cortina que bloquea la luz'),
    (N'Hogar', N'Organizador de closet', N'Organizador de tela con divisiones'),
    (N'Hogar', N'Escoba y recogedor', N'Juego de limpieza'),
    (N'Cocina', N'Licuadora', N'Licuadora de 600 W con vaso de vidrio'),
    (N'Cocina', N'Sartén antiadherente', N'Sartén de aluminio con recubrimiento'),
    (N'Cocina', N'Juego de cuchillos', N'Seis cuchillos de acero inoxidable con base'),
    (N'Cocina', N'Cafetera de goteo', N'Cafetera para 12 tazas'),
    (N'Cocina', N'Tabla para picar', N'Tabla de bambú'),
    (N'Cocina', N'Olla de presión', N'Olla de presión de acero'),
    (N'Cocina', N'Termo de acero', N'Termo que conserva la temperatura 12 horas'),
    (N'Ropa', N'Camisa formal', N'Camisa de manga larga'),
    (N'Ropa', N'Playera básica', N'Playera de algodón'),
    (N'Ropa', N'Pantalón de mezclilla', N'Pantalón corte recto'),
    (N'Ropa', N'Chaqueta impermeable', N'Chaqueta ligera para lluvia'),
    (N'Ropa', N'Suéter de lana', N'Suéter tejido'),
    (N'Ropa', N'Gorra', N'Gorra ajustable'),
    (N'Calzado', N'Tenis para correr', N'Tenis livianos con amortiguación'),
    (N'Calzado', N'Zapato formal', N'Zapato de cuero'),
    (N'Calzado', N'Sandalias', N'Sandalias de playa'),
    (N'Calzado', N'Botas de trabajo', N'Botas con punta reforzada'),
    (N'Calzado', N'Pantuflas', N'Pantuflas acolchadas'),
    (N'Deportes', N'Balón de fútbol', N'Balón número 5'),
    (N'Deportes', N'Pesas ajustables', N'Par de mancuernas'),
    (N'Deportes', N'Tapete de yoga', N'Tapete antideslizante'),
    (N'Deportes', N'Bicicleta de montaña', N'Bicicleta rodada 29'),
    (N'Deportes', N'Botella deportiva', N'Botella de 750 ml'),
    (N'Deportes', N'Cuerda para saltar', N'Cuerda con contador'),
    (N'Juguetes', N'Rompecabezas 1000 piezas', N'Rompecabezas de paisaje'),
    (N'Juguetes', N'Bloques de construcción', N'Set de 500 bloques'),
    (N'Juguetes', N'Carro a control remoto', N'Carro todoterreno recargable'),
    (N'Juguetes', N'Muñeca articulada', N'Muñeca con accesorios'),
    (N'Juguetes', N'Juego de mesa familiar', N'Juego para 2 a 6 jugadores'),
    (N'Juguetes', N'Pelota saltarina', N'Pelota de goma')
) AS p (Categoria, Nombre, Descripcion)
JOIN dbo.Categorias c ON c.Nombre = p.Categoria;
GO

------------------------------------------------------------
-- Variantes (precios con IVA incluido)
------------------------------------------------------------
INSERT INTO dbo.Variantes (IDProducto, SKU, Atributos, Precio, Existencia)
SELECT pr.IDProducto, v.SKU, v.Atributos, v.Precio, v.Existencia
FROM (VALUES
    (N'Audífonos inalámbricos', N'ELE-AUD-NEG', N'{"Color":"Negro"}', 349.00, 40),
    (N'Audífonos inalámbricos', N'ELE-AUD-BLA', N'{"Color":"Blanco"}', 349.00, 25),
    (N'Bocina portátil', N'ELE-BOC-001', N'{}', 299.90, 30),
    (N'Televisor 43 pulgadas', N'ELE-TV-43', N'{"Tamaño":"43"}', 2899.00, 8),
    (N'Cargador rápido USB-C', N'ELE-CAR-20W', N'{"Potencia":"20 W"}', 129.00, 100),
    (N'Cámara de seguridad', N'ELE-CAM-001', N'{}', 459.00, 15),
    (N'Reloj inteligente', N'ELE-REL-NEG', N'{"Color":"Negro"}', 799.00, 12),
    (N'Reloj inteligente', N'ELE-REL-ROS', N'{"Color":"Rosado"}', 799.00, 10),
    (N'Batería externa', N'ELE-BAT-10K', N'{}', 189.50, 60),
    (N'Laptop 14 pulgadas', N'COM-LAP-256', N'{"Almacenamiento":"256 GB"}', 5499.00, 6),
    (N'Laptop 14 pulgadas', N'COM-LAP-512', N'{"Almacenamiento":"512 GB"}', 6299.00, 4),
    (N'Mouse inalámbrico', N'COM-MOU-001', N'{}', 89.90, 80),
    (N'Teclado mecánico', N'COM-TEC-001', N'{"Distribución":"Español"}', 549.00, 20),
    (N'Monitor 24 pulgadas', N'COM-MON-24', N'{}', 1199.00, 10),
    (N'Memoria USB', N'COM-USB-64', N'{"Capacidad":"64 GB"}', 69.00, 150),
    (N'Memoria USB', N'COM-USB-128', N'{"Capacidad":"128 GB"}', 119.00, 90),
    (N'Disco SSD externo', N'COM-SSD-1TB', N'{"Capacidad":"1 TB"}', 899.00, 14),
    (N'Cámara web', N'COM-WEB-001', N'{}', 279.00, 25),
    (N'Lámpara de escritorio', N'HOG-LAM-001', N'{}', 159.00, 35),
    (N'Juego de sábanas', N'HOG-SAB-IND', N'{"Tamaño":"Individual"}', 199.00, 20),
    (N'Juego de sábanas', N'HOG-SAB-MAT', N'{"Tamaño":"Matrimonial"}', 259.00, 20),
    (N'Almohada', N'HOG-ALM-001', N'{}', 149.00, 45),
    (N'Cortina blackout', N'HOG-COR-GRI', N'{"Color":"Gris"}', 225.00, 18),
    (N'Organizador de closet', N'HOG-ORG-001', N'{}', 99.00, 30),
    (N'Escoba y recogedor', N'HOG-ESC-001', N'{}', 59.90, 50),
    (N'Licuadora', N'COC-LIC-001', N'{}', 399.00, 22),
    (N'Sartén antiadherente', N'COC-SAR-24', N'{"Diámetro":"24 cm"}', 179.00, 30),
    (N'Sartén antiadherente', N'COC-SAR-28', N'{"Diámetro":"28 cm"}', 219.00, 25),
    (N'Juego de cuchillos', N'COC-CUC-006', N'{}', 329.00, 15),
    (N'Cafetera de goteo', N'COC-CAF-012', N'{}', 289.00, 18),
    (N'Tabla para picar', N'COC-TAB-001', N'{}', 79.00, 40),
    (N'Olla de presión', N'COC-OLL-006', N'{"Capacidad":"6 L"}', 449.00, 12),
    (N'Termo de acero', N'COC-TER-500', N'{"Capacidad":"500 ml"}', 139.00, 55),
    (N'Camisa formal', N'ROP-CAM-M', N'{"Talla":"M"}', 229.00, 25),
    (N'Camisa formal', N'ROP-CAM-L', N'{"Talla":"L"}', 229.00, 25),
    (N'Playera básica', N'ROP-PLA-S', N'{"Talla":"S"}', 69.00, 60),
    (N'Playera básica', N'ROP-PLA-M', N'{"Talla":"M"}', 69.00, 80),
    (N'Playera básica', N'ROP-PLA-L', N'{"Talla":"L"}', 69.00, 70),
    (N'Pantalón de mezclilla', N'ROP-PAN-32', N'{"Talla":"32"}', 299.00, 30),
    (N'Pantalón de mezclilla', N'ROP-PAN-34', N'{"Talla":"34"}', 299.00, 30),
    (N'Chaqueta impermeable', N'ROP-CHA-M', N'{"Talla":"M"}', 459.00, 12),
    (N'Suéter de lana', N'ROP-SUE-M', N'{"Talla":"M"}', 319.00, 16),
    (N'Gorra', N'ROP-GOR-001', N'{}', 89.00, 45),
    (N'Tenis para correr', N'CAL-TEN-40', N'{"Talla":"40"}', 649.00, 15),
    (N'Tenis para correr', N'CAL-TEN-42', N'{"Talla":"42"}', 649.00, 15),
    (N'Zapato formal', N'CAL-ZAP-41', N'{"Talla":"41"}', 579.00, 10),
    (N'Sandalias', N'CAL-SAN-001', N'{}', 99.00, 40),
    (N'Botas de trabajo', N'CAL-BOT-42', N'{"Talla":"42"}', 699.00, 9),
    (N'Pantuflas', N'CAL-PAN-001', N'{}', 119.00, 35),
    (N'Balón de fútbol', N'DEP-BAL-005', N'{}', 179.00, 30),
    (N'Pesas ajustables', N'DEP-PES-010', N'{"Peso":"10 kg"}', 499.00, 10),
    (N'Tapete de yoga', N'DEP-TAP-001', N'{}', 159.00, 25),
    (N'Bicicleta de montaña', N'DEP-BIC-029', N'{}', 3299.00, 3),
    (N'Botella deportiva', N'DEP-BOT-750', N'{}', 59.00, 70),
    (N'Cuerda para saltar', N'DEP-CUE-001', N'{}', 49.00, 50),
    (N'Rompecabezas 1000 piezas', N'JUG-ROM-1000', N'{}', 149.00, 20),
    (N'Bloques de construcción', N'JUG-BLO-500', N'{}', 249.00, 18),
    (N'Carro a control remoto', N'JUG-CAR-001', N'{}', 389.00, 12),
    (N'Muñeca articulada', N'JUG-MUN-001', N'{}', 199.00, 22),
    (N'Juego de mesa familiar', N'JUG-MES-001', N'{}', 229.00, 15),
    (N'Pelota saltarina', N'JUG-PEL-001', N'{}', 25.00, 0)
) AS v (Producto, SKU, Atributos, Precio, Existencia)
JOIN dbo.Productos pr ON pr.Nombre = v.Producto;
GO

-- La existencia inicial entra por el kardex para que ambos coincidan.
INSERT INTO dbo.Kardex (IDVariante, Tipo, Cantidad, ExistenciaResultante, Motivo, IDUsuario)
SELECT v.IDVariante, N'Entrada', v.Existencia, v.Existencia, N'Inventario inicial',
       (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'admin@shopcart.test')
FROM dbo.Variantes v
WHERE v.Existencia > 0;
GO

------------------------------------------------------------
-- Cupones de ejemplo
------------------------------------------------------------
INSERT INTO dbo.Cupones (Codigo, Tipo, Valor, FechaInicio, FechaFin, MinimoCompra, LimiteTotal, LimitePorCliente, IDCategoria, Activo)
VALUES
    -- 10 % sobre el carrito, una vez por cliente.
    (N'BIENVENIDA10', N'Porcentaje', 10, '2026-01-01', '2027-12-31', 0, NULL, 1, NULL, 1),
    -- Q50 de descuento con compra mínima de Q300, 100 usos en total.
    (N'Q50', N'Monto', 50, '2026-01-01', '2027-12-31', 300, 100, 2, NULL, 1),
    -- 15 % solo en productos de Electrónica.
    (N'ELECTRO15', N'Porcentaje', 15, '2026-01-01', '2027-12-31', 0, NULL, NULL,
        (SELECT IDCategoria FROM dbo.Categorias WHERE Nombre = N'Electrónica'), 1),
    -- Para probar concurrencia: solo 5 usos en total.
    (N'LIMITADO5', N'Monto', 10, '2026-01-01', '2027-12-31', 0, 5, NULL, NULL, 1),
    -- Para probar rechazos.
    (N'VENCIDO', N'Porcentaje', 20, '2025-01-01', '2025-12-31', 0, NULL, NULL, NULL, 1),
    (N'INACTIVO', N'Porcentaje', 20, '2026-01-01', '2027-12-31', 0, NULL, NULL, NULL, 0);
GO
