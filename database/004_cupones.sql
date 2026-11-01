-- Cupones: cálculo del descuento, validación con causa específica y registro de uso.

-- Descuento por línea de un carrito para un cupón. Un @IDCupon NULL, inexistente o
-- que hoy no aplica (inactivo, fuera de vigencia, bajo el mínimo) da descuento 0.
-- El descuento total se calcula una sola vez y se reparte por líneas con
-- diferencias de sumas acumuladas redondeadas, así la suma de las líneas es
-- exactamente el total (sin errores de redondeo) y nunca supera la base elegible.
CREATE OR ALTER FUNCTION dbo.FU_Cupones_CalculoDescuento (@IDCarrito INT, @IDCupon INT)
RETURNS TABLE
AS
RETURN
    WITH Lineas AS (
        SELECT cd.IDVariante, cd.Cantidad, v.Precio AS PrecioUnitario,
               CAST(cd.Cantidad * v.Precio AS DECIMAL(12,2)) AS Subtotal,
               p.IDCategoria
        FROM dbo.CarritoDetalle cd
        JOIN dbo.Variantes v ON v.IDVariante = cd.IDVariante
        JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
        WHERE cd.IDCarrito = @IDCarrito
    ),
    Cupon AS (
        SELECT c.IDCupon, c.Tipo, c.Valor, c.IDCategoria
        FROM dbo.Cupones c
        WHERE c.IDCupon = @IDCupon
          AND c.Activo = 1
          AND SYSUTCDATETIME() >= c.FechaInicio AND SYSUTCDATETIME() < c.FechaFin
          AND (SELECT ISNULL(SUM(Subtotal), 0) FROM Lineas) >= c.MinimoCompra
    ),
    Base AS (
        SELECT l.IDVariante, l.Cantidad, l.PrecioUnitario, l.Subtotal, c.Tipo, c.Valor,
               CAST(CASE WHEN c.IDCupon IS NOT NULL AND (c.IDCategoria IS NULL OR c.IDCategoria = l.IDCategoria)
                         THEN l.Subtotal ELSE 0 END AS DECIMAL(12,2)) AS Elegible
        FROM Lineas l
        LEFT JOIN Cupon c ON 1 = 1
    ),
    Acumulado AS (
        SELECT *,
               SUM(Elegible) OVER () AS BaseTotal,
               SUM(Elegible) OVER (ORDER BY IDVariante ROWS UNBOUNDED PRECEDING) AS Acum
        FROM Base
    ),
    Total AS (
        SELECT *,
               CASE WHEN Tipo = N'Porcentaje' THEN ROUND(BaseTotal * Valor / 100, 2)
                    WHEN Tipo = N'Monto' THEN CASE WHEN Valor < BaseTotal THEN Valor ELSE BaseTotal END
                    ELSE 0 END AS DescuentoTotal
        FROM Acumulado
    )
    SELECT IDVariante, Cantidad, PrecioUnitario, Subtotal,
           CAST(CASE WHEN BaseTotal = 0 THEN 0
                     ELSE ROUND(DescuentoTotal * Acum / BaseTotal, 2)
                        - ROUND(DescuentoTotal * (Acum - Elegible) / BaseTotal, 2) END AS DECIMAL(12,2)) AS Descuento
    FROM Total;
GO

-- Valida un cupón para el cliente y el carrito. Cada rechazo dice su causa.
-- No consume el uso: eso ocurre al crear el pedido (SP_Cupones_RegistrarUso).
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Validar
    @IDUsuario INT,
    @IDCarrito INT,
    @Codigo    NVARCHAR(30),
    @IDCupon   INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF @Codigo IS NULL OR LEN(LTRIM(RTRIM(@Codigo))) = 0
        THROW 52400, N'Debe indicar el código del cupón.', 1;

    DECLARE @Tipo NVARCHAR(10), @FechaInicio DATETIME2(0), @FechaFin DATETIME2(0),
            @Minimo DECIMAL(12,2), @LimiteTotal INT, @LimiteCliente INT, @Usos INT,
            @IDCategoria INT, @Activo BIT, @Ahora DATETIME2(0) = SYSUTCDATETIME();

    SELECT @IDCupon = IDCupon, @Tipo = Tipo, @FechaInicio = FechaInicio, @FechaFin = FechaFin,
           @Minimo = MinimoCompra, @LimiteTotal = LimiteTotal, @LimiteCliente = LimitePorCliente,
           @Usos = Usos, @IDCategoria = IDCategoria, @Activo = Activo
    FROM dbo.Cupones
    WHERE Codigo = LTRIM(RTRIM(@Codigo));

    IF @IDCupon IS NULL THROW 52404, N'El cupón no existe.', 1;
    IF @Activo = 0 THROW 52409, N'El cupón está desactivado.', 1;
    IF @Ahora < @FechaInicio THROW 52409, N'El cupón todavía no está vigente.', 1;
    IF @Ahora >= @FechaFin THROW 52409, N'El cupón está vencido.', 1;

    DECLARE @Subtotal DECIMAL(12,2), @Elegible DECIMAL(12,2);
    SELECT @Subtotal = ISNULL(SUM(cd.Cantidad * v.Precio), 0),
           @Elegible = ISNULL(SUM(CASE WHEN @IDCategoria IS NULL OR p.IDCategoria = @IDCategoria
                                       THEN cd.Cantidad * v.Precio ELSE 0 END), 0)
    FROM dbo.CarritoDetalle cd
    JOIN dbo.Variantes v ON v.IDVariante = cd.IDVariante
    JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
    WHERE cd.IDCarrito = @IDCarrito;

    IF @Subtotal = 0 THROW 52400, N'El carrito está vacío.', 1;
    IF @Elegible = 0 THROW 52409, N'El cupón solo aplica a productos de otra categoría que no están en el carrito.', 1;
    IF @Subtotal < @Minimo
        THROW 52409, N'No alcanza la compra mínima del cupón.', 1;
    IF @LimiteTotal IS NOT NULL AND @Usos >= @LimiteTotal
        THROW 52409, N'El cupón alcanzó su límite total de usos.', 1;
    IF @LimiteCliente IS NOT NULL AND
       (SELECT COUNT(*) FROM dbo.CuponUsos WHERE IDCupon = @IDCupon AND IDUsuario = @IDUsuario AND Anulado = 0) >= @LimiteCliente
        THROW 52409, N'Ya usó este cupón el máximo de veces permitido.', 1;
END;
GO

-- Consume un uso dentro de la transacción del pedido. El UPDATE condicionado
-- toma el bloqueo de la fila del cupón, así los pedidos que usan el mismo cupón
-- se serializan y el límite total y el límite por cliente se revisan sin carreras.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_RegistrarUso
    @IDCupon   INT,
    @IDUsuario INT,
    @IDPedido  INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @@TRANCOUNT = 0 THROW 52500, N'El uso de un cupón debe registrarse dentro de la transacción del pedido.', 1;

    UPDATE dbo.Cupones
    SET Usos = Usos + 1
    WHERE IDCupon = @IDCupon AND Activo = 1 AND (LimiteTotal IS NULL OR Usos < LimiteTotal);

    IF @@ROWCOUNT = 0
        THROW 52409, N'El cupón ya no está disponible: alcanzó su límite total o fue desactivado.', 1;

    DECLARE @LimiteCliente INT = (SELECT LimitePorCliente FROM dbo.Cupones WHERE IDCupon = @IDCupon);
    IF @LimiteCliente IS NOT NULL AND
       (SELECT COUNT(*) FROM dbo.CuponUsos WHERE IDCupon = @IDCupon AND IDUsuario = @IDUsuario AND Anulado = 0) >= @LimiteCliente
        THROW 52409, N'Ya usó este cupón el máximo de veces permitido.', 1;

    INSERT INTO dbo.CuponUsos (IDCupon, IDUsuario, IDPedido) VALUES (@IDCupon, @IDUsuario, @IDPedido);
END;
GO

-- Al cancelar un pedido el uso del cupón se devuelve. Una devolución no lo devuelve.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_AnularUso
    @IDPedido INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @@TRANCOUNT = 0 THROW 52500, N'Debe ejecutarse dentro de una transacción.', 1;

    DECLARE @IDCupon INT;
    UPDATE dbo.CuponUsos SET Anulado = 1, @IDCupon = IDCupon
    WHERE IDPedido = @IDPedido AND Anulado = 0;

    IF @IDCupon IS NOT NULL
        UPDATE dbo.Cupones SET Usos = Usos - 1 WHERE IDCupon = @IDCupon;
END;
GO
