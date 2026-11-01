-- Devuelve la reserva (encabezado y líneas) de un cliente.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_ObtenerReserva
    @IDUsuario INT,
    @IDReserva INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Reservas WHERE IDReserva = @IDReserva AND IDUsuario = @IDUsuario)
        THROW 52404, N'La reserva no existe.', 1;

    SELECT r.IDReserva, r.Estado, r.Expira,
           CASE WHEN r.Estado = N'Activa' AND r.Expira <= SYSUTCDATETIME() THEN 1 ELSE 0 END AS Vencida,
           c.Codigo AS Cupon, r.Subtotal, r.Descuento, r.Total,
           r.IDDireccion, r.Direccion, r.Ciudad, r.Telefono
    FROM dbo.Reservas r
    LEFT JOIN dbo.Cupones c ON c.IDCupon = r.IDCupon
    WHERE r.IDReserva = @IDReserva;

    SELECT rd.IDVariante, v.SKU, p.Nombre AS Producto, rd.Cantidad, rd.PrecioUnitario, rd.Descuento
    FROM dbo.ReservaDetalle rd
    JOIN dbo.Variantes v ON v.IDVariante = rd.IDVariante
    JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
    WHERE rd.IDReserva = @IDReserva
    ORDER BY rd.IDVariante;
END;
GO
