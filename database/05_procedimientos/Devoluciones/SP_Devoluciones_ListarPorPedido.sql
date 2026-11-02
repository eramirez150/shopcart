-- Devoluciones de un pedido. El Cliente solo consulta las de sus pedidos; el personal
-- necesita pedidos.ver.
CREATE OR ALTER PROCEDURE dbo.SP_Devoluciones_ListarPorPedido
    @IDUsuario INT,
    @IDPedido  INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Rol NVARCHAR(20) = dbo.FU_Auth_Rol(@IDUsuario);
    IF @Rol IS NULL THROW 52403, N'Usuario no autorizado.', 1;
    IF @Rol <> N'Cliente' AND dbo.FU_Auth_TienePermiso(@IDUsuario, N'pedidos.ver') = 0
        THROW 52403, N'No tiene permiso para consultar pedidos.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Pedidos WHERE IDPedido = @IDPedido AND (@Rol <> N'Cliente' OR IDUsuario = @IDUsuario))
        THROW 52404, N'El pedido no existe.', 1;

    SELECT IDDevolucion, IDPedido, IDUsuario, Motivo, Monto, Fecha
    FROM dbo.Devoluciones WHERE IDPedido = @IDPedido ORDER BY IDDevolucion;

    SELECT dd.IDDevolucion, dd.IDPedidoDetalle, v.SKU, dd.Cantidad, dd.Monto
    FROM dbo.DevolucionDetalle dd
    JOIN dbo.Devoluciones dv ON dv.IDDevolucion = dd.IDDevolucion
    JOIN dbo.PedidoDetalle pd ON pd.IDPedidoDetalle = dd.IDPedidoDetalle
    JOIN dbo.Variantes v ON v.IDVariante = pd.IDVariante
    WHERE dv.IDPedido = @IDPedido
    ORDER BY dd.IDDevolucion, dd.IDPedidoDetalle;
END;
GO
