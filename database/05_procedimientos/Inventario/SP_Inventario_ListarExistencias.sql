-- Existencia, reservado y disponible por variante. @Umbral filtra las que
-- tienen disponible igual o menor al umbral.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarExistencias
    @Umbral INT = NULL,
    @Pagina INT = 1,
    @Tamano INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;

    SELECT v.IDVariante, v.SKU, p.Nombre AS Producto, v.Atributos,
           d.Existencia, d.Reservado, d.Disponible,
           COUNT(*) OVER () AS TotalFilas
    FROM dbo.FU_Inventario_Disponibilidad() d
    JOIN dbo.Variantes v ON v.IDVariante = d.IDVariante
    JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
    WHERE v.Activa = 1 AND (@Umbral IS NULL OR d.Disponible <= @Umbral)
    ORDER BY d.Disponible, v.IDVariante
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO
