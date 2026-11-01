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
