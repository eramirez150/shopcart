-- Pedido con sus líneas e historial. El Cliente solo ve los suyos; el personal
-- necesita pedidos.ver y ve todos. Un pedido ajeno responde como inexistente.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_Obtener
    @IDUsuario INT,
    @IDPedido  INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Rol NVARCHAR(20) = dbo.FU_Auth_Rol(@IDUsuario);
    IF @Rol IS NULL THROW 52403, N'Usuario no autorizado.', 1;
    IF @Rol <> N'Cliente' AND dbo.FU_Auth_TienePermiso(@IDUsuario, N'pedidos.ver') = 0
        THROW 52403, N'No tiene permiso para consultar pedidos.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Pedidos
                   WHERE IDPedido = @IDPedido AND (@Rol <> N'Cliente' OR IDUsuario = @IDUsuario))
        THROW 52404, N'El pedido no existe.', 1;

    SELECT p.IDPedido, p.IDUsuario, u.Nombre AS Cliente, p.Estado, c.Codigo AS Cupon,
           p.Subtotal, p.Descuento, p.Total, p.IVA, p.IDDireccion, p.Direccion, p.Ciudad, p.Telefono,
           p.ReferenciaPago, p.FechaCreacion, p.FechaActualizacion
    FROM dbo.Pedidos p
    JOIN dbo.Usuarios u ON u.IDUsuario = p.IDUsuario
    LEFT JOIN dbo.Cupones c ON c.IDCupon = p.IDCupon
    WHERE p.IDPedido = @IDPedido;

    SELECT d.IDPedidoDetalle, d.IDVariante, v.SKU, pr.Nombre AS Producto, d.Cantidad,
           d.PrecioUnitario, d.Descuento, d.CantidadDevuelta
    FROM dbo.PedidoDetalle d
    JOIN dbo.Variantes v ON v.IDVariante = d.IDVariante
    JOIN dbo.Productos pr ON pr.IDProducto = v.IDProducto
    WHERE d.IDPedido = @IDPedido
    ORDER BY d.IDPedidoDetalle;

    SELECT h.EstadoAnterior, h.EstadoNuevo, h.IDUsuario, us.Nombre AS Usuario, h.Comentario, h.Fecha
    FROM dbo.PedidoHistorial h
    JOIN dbo.Usuarios us ON us.IDUsuario = h.IDUsuario
    WHERE h.IDPedido = @IDPedido
    ORDER BY h.IDPedidoHistorial;
END;
GO
