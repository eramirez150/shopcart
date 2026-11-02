-- Hasta 12 productos para sugerir en el detalle: primero los de la misma categoría y
-- luego otros, en orden aleatorio. Solo lo que muestra la búsqueda pública (producto y
-- categoría activos, con variantes activas) y con la misma forma que sus tarjetas.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ObtenerRelacionados
    @IDProducto       INT,
    @IncluirInactivos BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDCategoria INT = (SELECT IDCategoria FROM dbo.Productos
                                WHERE IDProducto = @IDProducto AND (@IncluirInactivos = 1 OR Activo = 1));
    IF @IDCategoria IS NULL THROW 52404, N'El producto no existe.', 1;

    WITH Resumen AS (
        SELECT p.IDProducto, p.Nombre, p.Descripcion, p.IDCategoria, c.Nombre AS Categoria,
               MIN(v.Precio) AS PrecioDesde, MAX(v.Precio) AS PrecioHasta,
               SUM(d.Disponible) AS Disponible, COUNT(*) AS Variantes
        FROM dbo.Productos p
        JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
        JOIN dbo.Variantes v ON v.IDProducto = p.IDProducto AND v.Activa = 1
        JOIN dbo.FU_Inventario_Disponibilidad() d ON d.IDVariante = v.IDVariante
        WHERE p.Activo = 1 AND c.Activa = 1 AND p.IDProducto <> @IDProducto
        GROUP BY p.IDProducto, p.Nombre, p.Descripcion, p.IDCategoria, c.Nombre
    )
    SELECT TOP (12) IDProducto, Nombre, Descripcion, IDCategoria, Categoria, PrecioDesde, PrecioHasta,
           Disponible, Variantes,
           (SELECT TOP (1) i.Url FROM dbo.ProductoImagenes i
            WHERE i.IDProducto = Resumen.IDProducto ORDER BY i.Orden, i.IDProductoImagen) AS ImagenPrincipal
    FROM Resumen
    ORDER BY CASE WHEN IDCategoria = @IDCategoria THEN 0 ELSE 1 END, NEWID();
END;
GO
