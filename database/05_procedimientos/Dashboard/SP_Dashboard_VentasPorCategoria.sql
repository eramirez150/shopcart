CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_VentasPorCategoria
    @IDUsuario INT,
    @Desde     DATE = NULL,
    @Hasta     DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador consulta reportes.', 1;

    SELECT IDCategoria, Categoria, SUM(Unidades) AS Unidades, SUM(Neto) AS Ventas
    FROM dbo.VW_Dashboard_LineasVendidas
    WHERE (@Desde IS NULL OR Fecha >= @Desde) AND (@Hasta IS NULL OR Fecha < DATEADD(DAY, 1, @Hasta))
    GROUP BY IDCategoria, Categoria
    ORDER BY Ventas DESC;
END;
GO
