-- Una fila por línea de pedido completado: unidades y venta netas de devoluciones.
CREATE OR ALTER VIEW dbo.VW_Dashboard_LineasVendidas
AS
SELECT p.IDPedido, p.FechaCreacion AS Fecha, pr.IDCategoria, c.Nombre AS Categoria,
       pr.IDProducto, pr.Nombre AS Producto, pd.IDVariante,
       pd.Cantidad - pd.CantidadDevuelta AS Unidades,
       (pd.Cantidad * pd.PrecioUnitario - pd.Descuento) - ISNULL(dd.Devuelto, 0) AS Neto
FROM dbo.Pedidos p
JOIN dbo.PedidoDetalle pd ON pd.IDPedido = p.IDPedido
JOIN dbo.Variantes v ON v.IDVariante = pd.IDVariante
JOIN dbo.Productos pr ON pr.IDProducto = v.IDProducto
JOIN dbo.Categorias c ON c.IDCategoria = pr.IDCategoria
OUTER APPLY (SELECT SUM(Monto) AS Devuelto FROM dbo.DevolucionDetalle WHERE IDPedidoDetalle = pd.IDPedidoDetalle) dd
WHERE p.Estado IN (N'Entregado', N'DevueltoParcial');
GO
