------------------------------------------------------------
-- Productos y variantes
------------------------------------------------------------
-- Búsqueda con filtros, orden y paginación en el servidor. El orden usa CASE
-- sobre un parámetro tipado: no hay SQL dinámico.
-- @Orden: nombre (por defecto), precio_asc, precio_desc, recientes.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_BuscarProductos
    @Texto            NVARCHAR(100) = NULL,
    @IDCategoria      INT = NULL,
    @PrecioMin        DECIMAL(12,2) = NULL,
    @PrecioMax        DECIMAL(12,2) = NULL,
    @SoloDisponibles  BIT = 0,
    @Orden            NVARCHAR(20) = N'nombre',
    @Pagina           INT = 1,
    @Tamano           INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;
    IF @Orden NOT IN (N'nombre', N'precio_asc', N'precio_desc', N'recientes')
        THROW 52400, N'Orden inválido. Use nombre, precio_asc, precio_desc o recientes.', 1;

    WITH Resumen AS (
        SELECT p.IDProducto, p.Nombre, p.Descripcion, p.IDCategoria, c.Nombre AS Categoria, p.FechaCreacion,
               MIN(v.Precio) AS PrecioDesde, MAX(v.Precio) AS PrecioHasta,
               SUM(d.Disponible) AS Disponible, COUNT(*) AS Variantes
        FROM dbo.Productos p
        JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
        JOIN dbo.Variantes v ON v.IDProducto = p.IDProducto AND v.Activa = 1
        JOIN dbo.FU_Inventario_Disponibilidad() d ON d.IDVariante = v.IDVariante
        WHERE p.Activo = 1 AND c.Activa = 1
          AND (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
          AND (@Texto IS NULL OR CHARINDEX(@Texto, p.Nombre) > 0 OR CHARINDEX(@Texto, ISNULL(p.Descripcion, N'')) > 0)
        GROUP BY p.IDProducto, p.Nombre, p.Descripcion, p.IDCategoria, c.Nombre, p.FechaCreacion
    )
    SELECT IDProducto, Nombre, Descripcion, IDCategoria, Categoria, PrecioDesde, PrecioHasta,
           Disponible, Variantes, COUNT(*) OVER () AS TotalFilas
    FROM Resumen
    WHERE (@PrecioMin IS NULL OR PrecioHasta >= @PrecioMin)
      AND (@PrecioMax IS NULL OR PrecioDesde <= @PrecioMax)
      AND (@SoloDisponibles = 0 OR Disponible > 0)
    ORDER BY
        CASE WHEN @Orden = N'precio_asc'  THEN PrecioDesde END ASC,
        CASE WHEN @Orden = N'precio_desc' THEN PrecioDesde END DESC,
        CASE WHEN @Orden = N'recientes'   THEN FechaCreacion END DESC,
        Nombre, IDProducto
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO
