-- Listado filtrado y paginado de pedidos. El Cliente solo ve los suyos, sin
-- importar el filtro; el personal necesita pedidos.ver y ve todos.
-- @Orden: recientes (por defecto), antiguos, total_desc o total_asc. El orden usa
-- CASE sobre un parámetro tipado: no hay SQL dinámico.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_Listar
    @IDUsuario INT,
    @Estado    NVARCHAR(20) = NULL,
    @Desde     DATE = NULL,
    @Hasta     DATE = NULL,
    @IDCliente INT = NULL,
    @TotalMin  DECIMAL(12,2) = NULL,
    @TotalMax  DECIMAL(12,2) = NULL,
    @Orden     NVARCHAR(20) = N'recientes',
    @Pagina    INT = 1,
    @Tamano    INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Rol NVARCHAR(20) = dbo.FU_Auth_Rol(@IDUsuario);
    IF @Rol IS NULL THROW 52403, N'Usuario no autorizado.', 1;
    IF @Rol <> N'Cliente' AND dbo.FU_Auth_TienePermiso(@IDUsuario, N'pedidos.ver') = 0
        THROW 52403, N'No tiene permiso para consultar pedidos.', 1;
    IF @Rol = N'Cliente' SET @IDCliente = @IDUsuario;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;
    IF @Orden NOT IN (N'recientes', N'antiguos', N'total_desc', N'total_asc')
        THROW 52400, N'Orden inválido. Use recientes, antiguos, total_desc o total_asc.', 1;

    SELECT p.IDPedido, p.IDUsuario, u.Nombre AS Cliente, p.Estado, p.Subtotal, p.Descuento, p.Total,
           p.FechaCreacion, COUNT(*) OVER () AS TotalFilas
    FROM dbo.Pedidos p
    JOIN dbo.Usuarios u ON u.IDUsuario = p.IDUsuario
    WHERE (@Estado IS NULL OR p.Estado = @Estado)
      AND (@IDCliente IS NULL OR p.IDUsuario = @IDCliente)
      AND (@Desde IS NULL OR p.FechaCreacion >= @Desde)
      AND (@Hasta IS NULL OR p.FechaCreacion < DATEADD(DAY, 1, @Hasta))
      AND (@TotalMin IS NULL OR p.Total >= @TotalMin)
      AND (@TotalMax IS NULL OR p.Total <= @TotalMax)
    ORDER BY
        CASE WHEN @Orden = N'antiguos'   THEN p.FechaCreacion END ASC,
        CASE WHEN @Orden = N'antiguos'   THEN p.IDPedido END ASC,
        CASE WHEN @Orden = N'total_desc' THEN p.Total END DESC,
        CASE WHEN @Orden = N'total_asc'  THEN p.Total END ASC,
        p.FechaCreacion DESC, p.IDPedido DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO
