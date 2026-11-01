-- Una fila por pedido completado con su venta neta.
CREATE OR ALTER VIEW dbo.VW_Dashboard_PedidosCompletados
AS
SELECT p.IDPedido, p.IDUsuario, p.Estado, p.FechaCreacion AS Fecha, p.Total AS Bruto,
       ISNULL(dv.Devuelto, 0) AS Devuelto, p.Total - ISNULL(dv.Devuelto, 0) AS Neto
FROM dbo.Pedidos p
OUTER APPLY (SELECT SUM(Monto) AS Devuelto FROM dbo.Devoluciones WHERE IDPedido = p.IDPedido) dv
WHERE p.Estado IN (N'Entregado', N'DevueltoParcial');
GO
