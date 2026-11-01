-- Producto con sus variantes. Los clientes solo ven lo activo.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ObtenerProducto
    @IDProducto     INT,
    @IncluirInactivos BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE IDProducto = @IDProducto AND (@IncluirInactivos = 1 OR Activo = 1))
        THROW 52404, N'El producto no existe.', 1;

    SELECT p.IDProducto, p.Nombre, p.Descripcion, p.IDCategoria, c.Nombre AS Categoria, p.Activo, p.FechaCreacion
    FROM dbo.Productos p JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
    WHERE p.IDProducto = @IDProducto;

    SELECT v.IDVariante, v.SKU, v.Atributos, v.Precio, v.Activa, d.Existencia, d.Reservado, d.Disponible
    FROM dbo.Variantes v
    JOIN dbo.FU_Inventario_Disponibilidad() d ON d.IDVariante = v.IDVariante
    WHERE v.IDProducto = @IDProducto AND (@IncluirInactivos = 1 OR v.Activa = 1)
    ORDER BY v.IDVariante;
END;
GO
