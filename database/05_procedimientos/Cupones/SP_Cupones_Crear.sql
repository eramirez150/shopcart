CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Crear
    @IDUsuario        INT,
    @Codigo           NVARCHAR(30),
    @Tipo             NVARCHAR(10),
    @Valor            DECIMAL(12,2),
    @FechaInicio      DATETIME2(0),
    @FechaFin         DATETIME2(0),
    @MinimoCompra     DECIMAL(12,2) = 0,
    @LimiteTotal      INT = NULL,
    @LimitePorCliente INT = NULL,
    @IDCategoria      INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'cupones.gestionar') = 0
        THROW 52403, N'No tiene permiso para gestionar cupones.', 1;
    IF @Tipo NOT IN (N'Porcentaje', N'Monto') THROW 52400, N'El tipo debe ser Porcentaje o Monto.', 1;
    IF @Valor <= 0 OR (@Tipo = N'Porcentaje' AND @Valor > 100) THROW 52400, N'El valor del cupón no es válido.', 1;
    IF @FechaFin <= @FechaInicio THROW 52400, N'La fecha final debe ser posterior a la inicial.', 1;
    IF @MinimoCompra < 0 OR @LimiteTotal <= 0 OR @LimitePorCliente <= 0 THROW 52400, N'Mínimo o límites inválidos.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Cupones WHERE Codigo = LTRIM(RTRIM(@Codigo))) THROW 52409, N'El código ya existe.', 1;
    IF @IDCategoria IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria)
        THROW 52404, N'La categoría no existe.', 1;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;
    INSERT INTO dbo.Cupones (Codigo, Tipo, Valor, FechaInicio, FechaFin, MinimoCompra, LimiteTotal, LimitePorCliente, IDCategoria)
    VALUES (LTRIM(RTRIM(@Codigo)), @Tipo, @Valor, @FechaInicio, @FechaFin, @MinimoCompra, @LimiteTotal, @LimitePorCliente, @IDCategoria);

    SELECT IDCupon, Codigo, Tipo, Valor, FechaInicio, FechaFin, MinimoCompra, LimiteTotal,
           LimitePorCliente, Usos, IDCategoria, Activo
    FROM dbo.Cupones WHERE IDCupon = SCOPE_IDENTITY();
END;
GO
