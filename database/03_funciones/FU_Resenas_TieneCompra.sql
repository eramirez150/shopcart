-- 1 si el usuario tiene un pedido Entregado con alguna variante del producto.
CREATE OR ALTER FUNCTION dbo.FU_Resenas_TieneCompra (@IDUsuario INT, @IDProducto INT)
RETURNS BIT
AS
BEGIN
    RETURN CASE WHEN EXISTS (
        SELECT 1
        FROM dbo.Pedidos pe
        JOIN dbo.PedidoDetalle pd ON pd.IDPedido = pe.IDPedido
        JOIN dbo.Variantes v ON v.IDVariante = pd.IDVariante
        WHERE pe.IDUsuario = @IDUsuario AND pe.Estado = N'Entregado' AND v.IDProducto = @IDProducto
    ) THEN 1 ELSE 0 END;
END;
GO
