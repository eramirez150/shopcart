-- Indicadores del periodo (por fecha del pedido):
--   Pedidos y Ventas: pedidos completados (Entregado o DevueltoParcial) y su venta
--   neta de devoluciones, igual que el resto del dashboard.
--   PedidosPagados y MontoVendido: todos los pedidos pagados del periodo, es decir,
--   todos menos los cancelados, con su total cobrado.
--   TicketPromedio = MontoVendido / PedidosPagados, como lo define el glosario.
--   CarritosAbandonados: abiertos con productos y sin cambios en las últimas @Horas horas.
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_Indicadores
    @IDUsuario INT,
    @Desde     DATE = NULL,
    @Hasta     DATE = NULL,
    @Horas     INT = 24
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador consulta reportes.', 1;
    IF @Horas < 1 SET @Horas = 24;

    DECLARE @Abandonados INT = (
        SELECT COUNT(*) FROM dbo.Carritos c
        WHERE c.Estado = N'Abierto' AND c.FechaActualizacion < DATEADD(HOUR, -@Horas, SYSUTCDATETIME())
          AND EXISTS (SELECT 1 FROM dbo.CarritoDetalle WHERE IDCarrito = c.IDCarrito));

    DECLARE @PedidosPagados INT, @MontoVendido DECIMAL(14,2);
    SELECT @PedidosPagados = COUNT(*), @MontoVendido = ISNULL(SUM(Total), 0)
    FROM dbo.Pedidos
    WHERE Estado <> N'Cancelado'
      AND (@Desde IS NULL OR FechaCreacion >= @Desde) AND (@Hasta IS NULL OR FechaCreacion < DATEADD(DAY, 1, @Hasta));

    SELECT COUNT(*) AS Pedidos,
           ISNULL(SUM(Neto), 0) AS Ventas,
           @PedidosPagados AS PedidosPagados,
           @MontoVendido AS MontoVendido,
           CAST(CASE WHEN @PedidosPagados = 0 THEN 0 ELSE ROUND(@MontoVendido / @PedidosPagados, 2) END AS DECIMAL(12,2)) AS TicketPromedio,
           @Abandonados AS CarritosAbandonados
    FROM dbo.VW_Dashboard_PedidosCompletados
    WHERE (@Desde IS NULL OR Fecha >= @Desde) AND (@Hasta IS NULL OR Fecha < DATEADD(DAY, 1, @Hasta));
END;
GO
