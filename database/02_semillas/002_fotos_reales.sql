-- Generado por scraper/fotos-amazon.mjs a partir de scraper/fotos.json. No editar a mano.
-- Cambia la imagen de muestra de picsum.photos por una foto de referencia alojada por la
-- tienda de origen. Los productos sin foto que corresponda quedan sin imagen, así no muestran
-- una que no es suya. Solo toca las filas de picsum.photos: se puede ejecutar varias veces.

UPDATE i
SET Url = f.Url
FROM dbo.ProductoImagenes i
JOIN dbo.Productos p ON p.IDProducto = i.IDProducto
JOIN (VALUES
    (N'Almohada', N'https://m.media-amazon.com/images/I/715qJM8ZYRL._AC_UL640_FMwebp_QL65_.jpg'),
    (N'Audífonos inalámbricos', N'https://m.media-amazon.com/images/I/71k5FBbNioL._AC_UY436_FMwebp_QL65_.jpg'),
    (N'Balón de fútbol', N'https://m.media-amazon.com/images/I/51Zd5MYt-CL._AC_UL640_FMwebp_QL65_.jpg'),
    (N'Batería externa', N'https://m.media-amazon.com/images/I/71JJLJnwREL._AC_UY436_FMwebp_QL65_.jpg'),
    (N'Bicicleta de montaña', N'https://m.media-amazon.com/images/I/71VjhZx0dCL._AC_UY436_FMwebp_QL65_.jpg'),
    (N'Bloques de construcción', N'https://m.media-amazon.com/images/I/71syk7wl54L._AC_UL640_FMwebp_QL65_.jpg'),
    (N'Bocina portátil', N'https://m.media-amazon.com/images/I/8165VSHcJlL._AC_UY436_FMwebp_QL65_.jpg'),
    (N'Botas de trabajo', N'https://m.media-amazon.com/images/I/81UCxzjIxhL._AC_UL640_FMwebp_QL65_.jpg'),
    (N'Botella deportiva', N'https://m.media-amazon.com/images/I/61SdMJw+x2L._AC_UL640_FMwebp_QL65_.jpg'),
    (N'Cámara de seguridad', N'https://m.media-amazon.com/images/I/61GrnhJtS7L._AC_UY436_FMwebp_QL65_.jpg'),
    (N'Cámara web', N'https://m.media-amazon.com/images/I/71A0Pp767BL._AC_UY436_FMwebp_QL65_.jpg'),
    (N'Camisa formal', N'https://m.media-amazon.com/images/I/61PNhI8LicL._AC_UL640_FMwebp_QL65_.jpg'),
    (N'Cargador rápido USB-C', N'https://m.media-amazon.com/images/I/61drNXi5kFL._AC_UY436_FMwebp_QL65_.jpg'),
    (N'Carro a control remoto', N'https://m.media-amazon.com/images/I/71DyIw3331L._AC_UL640_FMwebp_QL65_.jpg'),
    (N'Cuerda para saltar', N'https://m.media-amazon.com/images/I/61FpBWbzoiL._AC_UL640_FMwebp_QL65_.jpg'),
    (N'Disco SSD externo', N'https://m.media-amazon.com/images/I/91YfRIy7kYL._AC_UY436_FMwebp_QL65_.jpg'),
    (N'Escoba y recogedor', N'https://m.media-amazon.com/images/I/61c0-W3aQ4L._AC_UL640_FMwebp_QL65_.jpg'),
    (N'Gorra', N'https://m.media-amazon.com/images/I/619RJ32NHUL._AC_UL640_FMwebp_QL65_.jpg'),
    (N'Laptop 14 pulgadas', N'https://m.media-amazon.com/images/I/71Na4bC1-6L._AC_UY436_FMwebp_QL65_.jpg'),
    (N'Licuadora', N'https://m.media-amazon.com/images/I/611eZN53I+L._AC_UY436_FMwebp_QL65_.jpg'),
    (N'Memoria USB', N'https://m.media-amazon.com/images/I/61uI5uuOrCL._AC_UY436_FMwebp_QL65_.jpg'),
    (N'Monitor 24 pulgadas', N'https://m.media-amazon.com/images/I/71kTwM8vbWL._AC_UY436_FMwebp_QL65_.jpg'),
    (N'Mouse inalámbrico', N'https://m.media-amazon.com/images/I/61qm452yy-L._AC_UY436_FMwebp_QL65_.jpg'),
    (N'Playera básica', N'https://m.media-amazon.com/images/I/81mGw1lfEcL._AC_UL640_FMwebp_QL65_.jpg'),
    (N'Reloj inteligente', N'https://m.media-amazon.com/images/I/51Tl5+beTbL._AC_UY436_FMwebp_QL65_.jpg'),
    (N'Rompecabezas 1000 piezas', N'https://m.media-amazon.com/images/I/81x+2+EJIuL._AC_UL640_FMwebp_QL65_.jpg'),
    (N'Sartén antiadherente', N'https://m.media-amazon.com/images/I/71FheZz5ZVL._AC_UL640_FMwebp_QL65_.jpg'),
    (N'Tabla para picar', N'https://m.media-amazon.com/images/I/71BcxNQ5r2L._AC_UL640_FMwebp_QL65_.jpg'),
    (N'Tapete de yoga', N'https://m.media-amazon.com/images/I/71IvGy2iCjL._AC_UL640_FMwebp_QL65_.jpg'),
    (N'Tenis para correr', N'https://m.media-amazon.com/images/I/414egjgn-uL._AC_UL640_FMwebp_QL65_.jpg')
) AS f (Producto, Url) ON f.Producto = p.Nombre
WHERE i.Url LIKE N'https://picsum.photos/%';
GO

DELETE FROM dbo.ProductoImagenes
WHERE Url LIKE N'https://picsum.photos/%';
GO
