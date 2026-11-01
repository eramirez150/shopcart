-- Listado del catálogo para el Administrador: incluye productos inactivos, de
-- categorías inactivas y sin variantes (la búsqueda pública los oculta).
-- @Activo filtra por estado (NULL = todos). @Orden: nombre (por defecto) o recientes.
-- El orden usa CASE sobre un parámetro tipado: no hay SQL dinámico.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ListarAdministracion
    @IDUsuario   INT,
    @Texto       NVARCHAR(100) = NULL,
    @IDCategoria INT = NULL,
    @Activo      BIT = NULL,
    @Orden       NVARCHAR(20) = N'nombre',
    @Pagina      INT = 1,
    @Tamano      INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona el catálogo.', 1;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;
    IF @Orden NOT IN (N'nombre', N'recientes')
        THROW 52400, N'Orden inválido. Use nombre o recientes.', 1;

    SELECT p.IDProducto, p.Nombre, p.IDCategoria, c.Nombre AS Categoria, c.Activa AS CategoriaActiva,
           p.Activo, p.FechaCreacion,
           ISNULL(x.Variantes, 0) AS Variantes,
           ISNULL(x.VariantesActivas, 0) AS VariantesActivas,
           x.PrecioDesde, x.PrecioHasta,
           ISNULL(x.Existencia, 0) AS Existencia,
           ISNULL(x.Disponible, 0) AS Disponible,
           (SELECT TOP (1) i.Url FROM dbo.ProductoImagenes i
            WHERE i.IDProducto = p.IDProducto ORDER BY i.Orden, i.IDProductoImagen) AS ImagenPrincipal,
           COUNT(*) OVER () AS TotalFilas
    FROM dbo.Productos p
    JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
    -- Sin variantes, el OUTER APPLY devuelve NULL y el producto igual aparece.
    OUTER APPLY (
        SELECT COUNT(*) AS Variantes,
               SUM(CASE WHEN v.Activa = 1 THEN 1 ELSE 0 END) AS VariantesActivas,
               MIN(v.Precio) AS PrecioDesde, MAX(v.Precio) AS PrecioHasta,
               SUM(d.Existencia) AS Existencia, SUM(d.Disponible) AS Disponible
        FROM dbo.Variantes v
        JOIN dbo.FU_Inventario_Disponibilidad() d ON d.IDVariante = v.IDVariante
        WHERE v.IDProducto = p.IDProducto
    ) x
    WHERE (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
      AND (@Activo IS NULL OR p.Activo = @Activo)
      AND (@Texto IS NULL OR CHARINDEX(@Texto, p.Nombre) > 0 OR CHARINDEX(@Texto, ISNULL(p.Descripcion, N'')) > 0)
    ORDER BY
        CASE WHEN @Orden = N'nombre'    THEN p.Nombre END ASC,
        CASE WHEN @Orden = N'recientes' THEN p.FechaCreacion END DESC,
        p.IDProducto DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO
