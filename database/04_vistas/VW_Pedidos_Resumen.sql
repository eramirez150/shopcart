-- Resumen de pedidos desde SSMS (solo lectura, no la usa la API).
-- Una fila por pedido con el cliente, los totales de sus líneas, el monto
-- devuelto y el código del cupón si lo usó. Las líneas y las devoluciones se
-- agregan por separado para que ninguna multiplique las filas de la otra.
-- Ejemplo: pedidos de un estado, del más reciente al más antiguo.
--   SELECT * FROM dbo.VW_Pedidos_Resumen WHERE Estado = N'Entregado' ORDER BY FechaCreacion DESC;
CREATE OR ALTER VIEW dbo.VW_Pedidos_Resumen
AS
SELECT p.IDPedido, p.FechaCreacion, p.IDUsuario, u.Nombre AS Cliente, u.Correo, p.Estado,
       ISNULL(l.Lineas, 0) AS Lineas,
       ISNULL(l.Unidades, 0) AS Unidades,
       ISNULL(l.UnidadesDevueltas, 0) AS UnidadesDevueltas,
       p.Subtotal, p.Descuento, p.Total,
       ISNULL(dv.MontoDevuelto, 0) AS MontoDevuelto,
       cu.Codigo AS Cupon
FROM dbo.Pedidos p
JOIN dbo.Usuarios u ON u.IDUsuario = p.IDUsuario
LEFT JOIN dbo.Cupones cu ON cu.IDCupon = p.IDCupon
OUTER APPLY (
    SELECT COUNT(*) AS Lineas, SUM(Cantidad) AS Unidades, SUM(CantidadDevuelta) AS UnidadesDevueltas
    FROM dbo.PedidoDetalle WHERE IDPedido = p.IDPedido
) l
OUTER APPLY (SELECT SUM(Monto) AS MontoDevuelto FROM dbo.Devoluciones WHERE IDPedido = p.IDPedido) dv;
GO
