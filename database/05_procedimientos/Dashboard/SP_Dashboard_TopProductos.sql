-- Productos más vendidos por unidades netas.
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_TopProductos
    @IDUsuario INT,
    @Desde     DATE = NULL,
    @Hasta     DATE = NULL,
    @Cantidad  INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador consulta reportes.', 1;
    IF @Cantidad < 1 OR @Cantidad > 50 SET @Cantidad = 10;

    SELECT TOP (@Cantidad) IDProducto, Producto, SUM(Unidades) AS Unidades, SUM(Neto) AS Ventas
    FROM dbo.VW_Dashboard_LineasVendidas
    WHERE (@Desde IS NULL OR Fecha >= @Desde) AND (@Hasta IS NULL OR Fecha < DATEADD(DAY, 1, @Hasta))
    GROUP BY IDProducto, Producto
    HAVING SUM(Unidades) > 0
    ORDER BY Unidades DESC, Ventas DESC, IDProducto;
END;
GO
