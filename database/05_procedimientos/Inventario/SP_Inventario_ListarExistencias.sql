-- Existencia, reservado y disponible por variante. @Umbral filtra las que
-- tienen disponible igual o menor al umbral.
-- @Orden: disponible (menor primero, por defecto), disponible_desc, sku o producto.
-- El orden usa CASE. Sin control de rol: la API solo deja entrar al Operador y al Administrador.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarExistencias
    @Umbral INT = NULL,
    @Orden  NVARCHAR(20) = N'disponible',
    @Pagina INT = 1,
    @Tamano INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;
    IF @Orden NOT IN (N'disponible', N'disponible_desc', N'sku', N'producto')
        THROW 52400, N'Orden inválido. Use disponible, disponible_desc, sku o producto.', 1;

    SELECT v.IDVariante, v.SKU, p.Nombre AS Producto, v.Atributos,
           d.Existencia, d.Reservado, d.Disponible,
           COUNT(*) OVER () AS TotalFilas
    FROM dbo.FU_Inventario_Disponibilidad() d
    JOIN dbo.Variantes v ON v.IDVariante = d.IDVariante
    JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
    WHERE v.Activa = 1 AND (@Umbral IS NULL OR d.Disponible <= @Umbral)
    ORDER BY
        CASE WHEN @Orden = N'disponible'      THEN d.Disponible END ASC,
        CASE WHEN @Orden = N'disponible_desc' THEN d.Disponible END DESC,
        CASE WHEN @Orden = N'sku'             THEN v.SKU END ASC,
        CASE WHEN @Orden = N'producto'        THEN p.Nombre END ASC,
        v.IDVariante
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO
