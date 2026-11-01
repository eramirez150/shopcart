-- Modifica un cupón. El límite total no puede quedar por debajo de los usos.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Actualizar
    @IDUsuario        INT,
    @IDCupon          INT,
    @Tipo             NVARCHAR(10),
    @Valor            DECIMAL(12,2),
    @FechaInicio      DATETIME2(0),
    @FechaFin         DATETIME2(0),
    @MinimoCompra     DECIMAL(12,2) = 0,
    @LimiteTotal      INT = NULL,
    @LimitePorCliente INT = NULL,
    @IDCategoria      INT = NULL,
    @Activo           BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona cupones.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Cupones WHERE IDCupon = @IDCupon) THROW 52404, N'El cupón no existe.', 1;
    IF @Tipo NOT IN (N'Porcentaje', N'Monto') THROW 52400, N'El tipo debe ser Porcentaje o Monto.', 1;
    IF @Valor <= 0 OR (@Tipo = N'Porcentaje' AND @Valor > 100) THROW 52400, N'El valor del cupón no es válido.', 1;
    IF @FechaFin <= @FechaInicio THROW 52400, N'La fecha final debe ser posterior a la inicial.', 1;
    IF @MinimoCompra < 0 OR @LimiteTotal <= 0 OR @LimitePorCliente <= 0 THROW 52400, N'Mínimo o límites inválidos.', 1;
    IF @LimiteTotal IS NOT NULL AND @LimiteTotal < (SELECT Usos FROM dbo.Cupones WHERE IDCupon = @IDCupon)
        THROW 52409, N'El límite total no puede ser menor que los usos actuales.', 1;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;
    UPDATE dbo.Cupones
    SET Tipo = @Tipo, Valor = @Valor, FechaInicio = @FechaInicio, FechaFin = @FechaFin, MinimoCompra = @MinimoCompra,
        LimiteTotal = @LimiteTotal, LimitePorCliente = @LimitePorCliente, IDCategoria = @IDCategoria, Activo = @Activo
    WHERE IDCupon = @IDCupon;

    SELECT IDCupon, Codigo, Tipo, Valor, FechaInicio, FechaFin, MinimoCompra, LimiteTotal,
           LimitePorCliente, Usos, IDCategoria, Activo
    FROM dbo.Cupones WHERE IDCupon = @IDCupon;
END;
GO
