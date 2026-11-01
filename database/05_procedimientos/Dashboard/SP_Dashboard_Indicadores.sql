-- Ticket promedio y carritos abandonados (abiertos con productos y sin cambios
-- en las últimas @Horas horas).
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

    SELECT COUNT(*) AS Pedidos,
           ISNULL(SUM(Neto), 0) AS Ventas,
           CAST(ISNULL(AVG(Neto), 0) AS DECIMAL(12,2)) AS TicketPromedio,
           @Abandonados AS CarritosAbandonados
    FROM dbo.VW_Dashboard_PedidosCompletados
    WHERE (@Desde IS NULL OR Fecha >= @Desde) AND (@Hasta IS NULL OR Fecha < DATEADD(DAY, 1, @Hasta));
END;
GO
