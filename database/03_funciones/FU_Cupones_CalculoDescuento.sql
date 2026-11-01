-- Descuento por línea de un carrito para un cupón. Un @IDCupon NULL, inexistente o
-- que hoy no aplica (inactivo, fuera de vigencia, bajo el mínimo) da descuento 0.
-- El descuento total se calcula una sola vez y se reparte por líneas con
-- diferencias de sumas acumuladas redondeadas, así la suma de las líneas es
-- exactamente el total (sin errores de redondeo) y nunca supera la base elegible.
CREATE OR ALTER FUNCTION dbo.FU_Cupones_CalculoDescuento (@IDCarrito INT, @IDCupon INT)
RETURNS TABLE
AS
RETURN
    WITH Lineas AS (
        SELECT cd.IDVariante, cd.Cantidad, v.Precio AS PrecioUnitario,
               CAST(cd.Cantidad * v.Precio AS DECIMAL(12,2)) AS Subtotal,
               p.IDCategoria
        FROM dbo.CarritoDetalle cd
        JOIN dbo.Variantes v ON v.IDVariante = cd.IDVariante
        JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
        WHERE cd.IDCarrito = @IDCarrito
    ),
    Cupon AS (
        SELECT c.IDCupon, c.Tipo, c.Valor, c.IDCategoria
        FROM dbo.Cupones c
        WHERE c.IDCupon = @IDCupon
          AND c.Activo = 1
          AND SYSUTCDATETIME() >= c.FechaInicio AND SYSUTCDATETIME() < c.FechaFin
          AND (SELECT ISNULL(SUM(Subtotal), 0) FROM Lineas) >= c.MinimoCompra
    ),
    Base AS (
        SELECT l.IDVariante, l.Cantidad, l.PrecioUnitario, l.Subtotal, c.Tipo, c.Valor,
               CAST(CASE WHEN c.IDCupon IS NOT NULL AND (c.IDCategoria IS NULL OR c.IDCategoria = l.IDCategoria)
                         THEN l.Subtotal ELSE 0 END AS DECIMAL(12,2)) AS Elegible
        FROM Lineas l
        LEFT JOIN Cupon c ON 1 = 1
    ),
    Acumulado AS (
        SELECT *,
               SUM(Elegible) OVER () AS BaseTotal,
               SUM(Elegible) OVER (ORDER BY IDVariante ROWS UNBOUNDED PRECEDING) AS Acum
        FROM Base
    ),
    Total AS (
        SELECT *,
               CASE WHEN Tipo = N'Porcentaje' THEN ROUND(BaseTotal * Valor / 100, 2)
                    WHEN Tipo = N'Monto' THEN CASE WHEN Valor < BaseTotal THEN Valor ELSE BaseTotal END
                    ELSE 0 END AS DescuentoTotal
        FROM Acumulado
    )
    SELECT IDVariante, Cantidad, PrecioUnitario, Subtotal,
           CAST(CASE WHEN BaseTotal = 0 THEN 0
                     ELSE ROUND(DescuentoTotal * Acum / BaseTotal, 2)
                        - ROUND(DescuentoTotal * (Acum - Elegible) / BaseTotal, 2) END AS DECIMAL(12,2)) AS Descuento
    FROM Total;
GO
