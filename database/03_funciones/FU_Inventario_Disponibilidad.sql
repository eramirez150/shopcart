-- Disponible = existencia física - reservas Activa con Expira futura.
-- Una reserva Consumida, Anulada o vencida no cuenta.
CREATE OR ALTER FUNCTION dbo.FU_Inventario_Disponibilidad ()
RETURNS TABLE
AS
RETURN
    SELECT
        v.IDVariante,
        v.Existencia,
        ISNULL(r.Reservado, 0) AS Reservado,
        CASE WHEN v.Existencia - ISNULL(r.Reservado, 0) < 0 THEN 0
             ELSE v.Existencia - ISNULL(r.Reservado, 0) END AS Disponible
    FROM dbo.Variantes v
    OUTER APPLY (
        SELECT SUM(rd.Cantidad) AS Reservado
        FROM dbo.ReservaDetalle rd
        JOIN dbo.Reservas rs ON rs.IDReserva = rd.IDReserva
        WHERE rd.IDVariante = v.IDVariante
          AND rs.Estado = N'Activa'
          AND rs.Expira > SYSUTCDATETIME()
    ) r;
GO
