-- Control de inventario desde SSMS (solo lectura, no la usa la API).
-- Una fila por variante. Disponible = Existencia - Reservado (reservas Activa con
-- Expira futura), tomado de FU_Inventario_Disponibilidad. SumaKardex es la suma
-- de los movimientos y DiferenciaKardex = Existencia - SumaKardex debe ser 0.
-- Ejemplo: filas con diferencia entre existencia y kardex.
--   SELECT * FROM dbo.VW_Inventario_Control WHERE DiferenciaKardex <> 0;
CREATE OR ALTER VIEW dbo.VW_Inventario_Control
AS
SELECT v.IDVariante, v.SKU, p.Nombre AS Producto, c.Nombre AS Categoria, v.Precio,
       d.Existencia, d.Reservado, d.Disponible,
       ISNULL(k.SumaKardex, 0) AS SumaKardex,
       d.Existencia - ISNULL(k.SumaKardex, 0) AS DiferenciaKardex,
       v.Activa
FROM dbo.Variantes v
JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
JOIN dbo.FU_Inventario_Disponibilidad() d ON d.IDVariante = v.IDVariante
OUTER APPLY (SELECT SUM(Cantidad) AS SumaKardex FROM dbo.Kardex WHERE IDVariante = v.IDVariante) k;
GO
