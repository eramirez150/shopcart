-- Encabezado (con subtotal, descuento y total) y líneas del carrito.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Consultar
    @IDCarrito INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDCupon INT = (SELECT IDCupon FROM dbo.Carritos WHERE IDCarrito = @IDCarrito);
    DECLARE @Calculo TABLE (IDVariante INT PRIMARY KEY, Cantidad INT, PrecioUnitario DECIMAL(12,2),
                            Subtotal DECIMAL(12,2), Descuento DECIMAL(12,2));
    INSERT INTO @Calculo SELECT IDVariante, Cantidad, PrecioUnitario, Subtotal, Descuento
    FROM dbo.FU_Cupones_CalculoDescuento(@IDCarrito, @IDCupon);

    SELECT c.IDCarrito, c.TokenInvitado, cu.Codigo AS Cupon,
           ISNULL((SELECT SUM(Subtotal) FROM @Calculo), 0) AS Subtotal,
           ISNULL((SELECT SUM(Descuento) FROM @Calculo), 0) AS Descuento,
           ISNULL((SELECT SUM(Subtotal) - SUM(Descuento) FROM @Calculo), 0) AS Total
    FROM dbo.Carritos c
    LEFT JOIN dbo.Cupones cu ON cu.IDCupon = c.IDCupon
    WHERE c.IDCarrito = @IDCarrito;

    SELECT k.IDVariante, v.SKU, p.Nombre AS Producto, v.Atributos, k.Cantidad, k.PrecioUnitario,
           k.Subtotal, k.Descuento, k.Subtotal - k.Descuento AS Total, d.Disponible,
           (SELECT TOP (1) i.Url FROM dbo.ProductoImagenes i
            WHERE i.IDProducto = p.IDProducto ORDER BY i.Orden, i.IDProductoImagen) AS ImagenPrincipal
    FROM @Calculo k
    JOIN dbo.Variantes v ON v.IDVariante = k.IDVariante
    JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
    JOIN dbo.FU_Inventario_Disponibilidad() d ON d.IDVariante = k.IDVariante
    ORDER BY k.IDVariante;
END;
GO
