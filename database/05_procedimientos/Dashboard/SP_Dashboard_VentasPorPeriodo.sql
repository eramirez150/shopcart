-- Ventas netas y número de pedidos por día, semana (inicia lunes) o mes.
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_VentasPorPeriodo
    @IDUsuario  INT,
    @Agrupacion NVARCHAR(10) = N'Dia',
    @Desde      DATE = NULL,
    @Hasta      DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'reportes.ver') = 0
        THROW 52403, N'No tiene permiso para consultar reportes.', 1;
    IF @Agrupacion NOT IN (N'Dia', N'Semana', N'Mes') THROW 52400, N'La agrupación debe ser Dia, Semana o Mes.', 1;

    WITH Pedidos AS (
        SELECT CAST(Fecha AS DATE) AS Dia, Neto
        FROM dbo.VW_Dashboard_PedidosCompletados
        WHERE (@Desde IS NULL OR Fecha >= @Desde) AND (@Hasta IS NULL OR Fecha < DATEADD(DAY, 1, @Hasta))
    )
    SELECT CASE @Agrupacion
               WHEN N'Dia' THEN Dia
               WHEN N'Semana' THEN DATEADD(DAY, -(DATEDIFF(DAY, '19000101', Dia) % 7), Dia)
               ELSE DATEFROMPARTS(YEAR(Dia), MONTH(Dia), 1) END AS Periodo,
           COUNT(*) AS Pedidos, SUM(Neto) AS Ventas
    FROM Pedidos
    GROUP BY CASE @Agrupacion
                 WHEN N'Dia' THEN Dia
                 WHEN N'Semana' THEN DATEADD(DAY, -(DATEDIFF(DAY, '19000101', Dia) % 7), Dia)
                 ELSE DATEFROMPARTS(YEAR(Dia), MONTH(Dia), 1) END
    ORDER BY Periodo;
END;
GO
