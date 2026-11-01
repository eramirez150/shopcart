-- Listado de pedidos, dashboard y bitácora.
-- Un pedido completado es Entregado o DevueltoParcial. Las ventas son netas:
-- se descuentan las devoluciones. Las fechas filtran por la del pedido.

-- Una fila por pedido completado con su venta neta.
CREATE OR ALTER VIEW dbo.VW_Dashboard_PedidosCompletados
AS
SELECT p.IDPedido, p.IDUsuario, p.Estado, p.FechaCreacion AS Fecha, p.Total AS Bruto,
       ISNULL(dv.Devuelto, 0) AS Devuelto, p.Total - ISNULL(dv.Devuelto, 0) AS Neto
FROM dbo.Pedidos p
OUTER APPLY (SELECT SUM(Monto) AS Devuelto FROM dbo.Devoluciones WHERE IDPedido = p.IDPedido) dv
WHERE p.Estado IN (N'Entregado', N'DevueltoParcial');
GO

-- Una fila por línea de pedido completado: unidades y venta netas de devoluciones.
CREATE OR ALTER VIEW dbo.VW_Dashboard_LineasVendidas
AS
SELECT p.IDPedido, p.FechaCreacion AS Fecha, pr.IDCategoria, c.Nombre AS Categoria,
       pr.IDProducto, pr.Nombre AS Producto, pd.IDVariante,
       pd.Cantidad - pd.CantidadDevuelta AS Unidades,
       (pd.Cantidad * pd.PrecioUnitario - pd.Descuento) - ISNULL(dd.Devuelto, 0) AS Neto
FROM dbo.Pedidos p
JOIN dbo.PedidoDetalle pd ON pd.IDPedido = p.IDPedido
JOIN dbo.Variantes v ON v.IDVariante = pd.IDVariante
JOIN dbo.Productos pr ON pr.IDProducto = v.IDProducto
JOIN dbo.Categorias c ON c.IDCategoria = pr.IDCategoria
OUTER APPLY (SELECT SUM(Monto) AS Devuelto FROM dbo.DevolucionDetalle WHERE IDPedidoDetalle = pd.IDPedidoDetalle) dd
WHERE p.Estado IN (N'Entregado', N'DevueltoParcial');
GO

-- Listado filtrado y paginado de pedidos. El Cliente solo ve los suyos, sin
-- importar el filtro; el Operador y el Administrador ven todos.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_Listar
    @IDUsuario INT,
    @Estado    NVARCHAR(20) = NULL,
    @Desde     DATE = NULL,
    @Hasta     DATE = NULL,
    @IDCliente INT = NULL,
    @TotalMin  DECIMAL(12,2) = NULL,
    @TotalMax  DECIMAL(12,2) = NULL,
    @Pagina    INT = 1,
    @Tamano    INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Rol NVARCHAR(20) = dbo.FU_Auth_Rol(@IDUsuario);
    IF @Rol IS NULL THROW 52403, N'Usuario no autorizado.', 1;
    IF @Rol = N'Cliente' SET @IDCliente = @IDUsuario;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;

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
    ORDER BY p.FechaCreacion DESC, p.IDPedido DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO

-- Ventas netas y número de pedidos por día, semana (inicia lunes) o mes.
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_VentasPorPeriodo
    @IDUsuario  INT,
    @Agrupacion NVARCHAR(10) = N'Dia',
    @Desde      DATE = NULL,
    @Hasta      DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador consulta reportes.', 1;
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

CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_CarritosAbandonados
    @IDUsuario INT,
    @Horas     INT = 24,
    @Pagina    INT = 1,
    @Tamano    INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador consulta reportes.', 1;
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

-- Bitácora (Administrador), filtrable por módulo. Solo lectura: la tabla
-- tiene un trigger que impide modificar o eliminar filas.
CREATE OR ALTER PROCEDURE dbo.SP_Bitacora_Listar
    @IDUsuario INT,
    @Modulo    NVARCHAR(20) = NULL,
    @Desde     DATE = NULL,
    @Hasta     DATE = NULL,
    @Pagina    INT = 1,
    @Tamano    INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador consulta la bitácora.', 1;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;

    SELECT b.IDBitacora, b.Fecha, b.IDUsuario, u.Nombre AS Usuario, b.Modulo, b.Entidad, b.IDEntidad,
           b.Accion, b.ValorAnterior, b.ValorNuevo, COUNT(*) OVER () AS TotalFilas
    FROM dbo.Bitacora b
    LEFT JOIN dbo.Usuarios u ON u.IDUsuario = b.IDUsuario
    WHERE (@Modulo IS NULL OR b.Modulo = @Modulo)
      AND (@Desde IS NULL OR b.Fecha >= @Desde)
      AND (@Hasta IS NULL OR b.Fecha < DATEADD(DAY, 1, @Hasta))
    ORDER BY b.IDBitacora DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO
