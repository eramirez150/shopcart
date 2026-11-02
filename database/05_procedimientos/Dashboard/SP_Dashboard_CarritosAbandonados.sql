CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_CarritosAbandonados
    @IDUsuario INT,
    @Horas     INT = 24,
    @Pagina    INT = 1,
    @Tamano    INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'reportes.ver') = 0
        THROW 52403, N'No tiene permiso para consultar reportes.', 1;
    IF @Horas < 1 SET @Horas = 24;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;

    SELECT c.IDCarrito, c.IDUsuario, u.Correo, c.FechaActualizacion,
           x.Lineas, x.Valor, COUNT(*) OVER () AS TotalFilas
    FROM dbo.Carritos c
    LEFT JOIN dbo.Usuarios u ON u.IDUsuario = c.IDUsuario
    CROSS APPLY (SELECT COUNT(*) AS Lineas, SUM(cd.Cantidad * v.Precio) AS Valor
                 FROM dbo.CarritoDetalle cd JOIN dbo.Variantes v ON v.IDVariante = cd.IDVariante
                 WHERE cd.IDCarrito = c.IDCarrito) x
    WHERE c.Estado = N'Abierto' AND c.FechaActualizacion < DATEADD(HOUR, -@Horas, SYSUTCDATETIME()) AND x.Lineas > 0
    ORDER BY c.FechaActualizacion
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO
