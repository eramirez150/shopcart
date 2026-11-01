-- Administración de cupones y devoluciones.

------------------------------------------------------------
-- Cupones (Administrador)
------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Listar
    @IDUsuario INT,
    @Pagina    INT = 1,
    @Tamano    INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona cupones.', 1;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;

    SELECT IDCupon, Codigo, Tipo, Valor, FechaInicio, FechaFin, MinimoCompra, LimiteTotal,
           LimitePorCliente, Usos, IDCategoria, Activo, COUNT(*) OVER () AS TotalFilas
    FROM dbo.Cupones
    ORDER BY IDCupon
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO

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
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona cupones.', 1;
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

------------------------------------------------------------
-- Devoluciones
------------------------------------------------------------
-- Registra una devolución total o parcial por línea. @Lineas es un arreglo JSON:
-- [{"idPedidoDetalle": 1, "cantidad": 2}]. Solo procede sobre un pedido
-- Entregado o DevueltoParcial y nunca más de lo vendido. Reintegra por kardex.
-- Un cupón no se devuelve. Monto de cada línea = parte proporcional de
-- (precio x cantidad - descuento), calculada de forma acumulada para que las
-- devoluciones de una línea sumen exactamente su valor.
CREATE OR ALTER PROCEDURE dbo.SP_Devoluciones_Registrar
    @IDUsuario INT,
    @IDPedido  INT,
    @Motivo    NVARCHAR(300),
    @Lineas    NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') NOT IN (N'Operador', N'Administrador')
        THROW 52403, N'No tiene permiso para registrar devoluciones.', 1;
    IF @Motivo IS NULL OR LEN(LTRIM(RTRIM(@Motivo))) = 0 THROW 52400, N'El motivo es obligatorio.', 1;
    IF ISJSON(@Lineas) <> 1 THROW 52400, N'Las líneas deben ser un arreglo JSON.', 1;

    DECLARE @Pedir TABLE (IDPedidoDetalle INT PRIMARY KEY, Cantidad INT NOT NULL);
    INSERT INTO @Pedir (IDPedidoDetalle, Cantidad)
    SELECT IDPedidoDetalle, SUM(Cantidad)
    FROM OPENJSON(@Lineas) WITH (IDPedidoDetalle INT '$.idPedidoDetalle', Cantidad INT '$.cantidad')
    GROUP BY IDPedidoDetalle;

    IF NOT EXISTS (SELECT 1 FROM @Pedir) OR EXISTS (SELECT 1 FROM @Pedir WHERE Cantidad IS NULL OR Cantidad <= 0)
        THROW 52400, N'Indique al menos una línea con cantidad mayor que cero.', 1;

    DECLARE @Estado NVARCHAR(20), @NuevoEstado NVARCHAR(20), @IDDevolucion INT, @Monto DECIMAL(12,2);

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @Estado = Estado FROM dbo.Pedidos WITH (UPDLOCK, HOLDLOCK) WHERE IDPedido = @IDPedido;
        IF @Estado IS NULL THROW 52404, N'El pedido no existe.', 1;
        IF @Estado NOT IN (N'Entregado', N'DevueltoParcial')
            THROW 52409, N'Solo se devuelven pedidos entregados.', 1;

        IF EXISTS (SELECT 1 FROM @Pedir p WHERE NOT EXISTS
                   (SELECT 1 FROM dbo.PedidoDetalle d WHERE d.IDPedidoDetalle = p.IDPedidoDetalle AND d.IDPedido = @IDPedido))
            THROW 52400, N'Una línea no pertenece al pedido.', 1;
        IF EXISTS (SELECT 1 FROM @Pedir p JOIN dbo.PedidoDetalle d ON d.IDPedidoDetalle = p.IDPedidoDetalle
                   WHERE p.Cantidad > d.Cantidad - d.CantidadDevuelta)
            THROW 52409, N'No se puede devolver más de lo vendido.', 1;

        EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

        DECLARE @Montos TABLE (IDPedidoDetalle INT PRIMARY KEY, IDVariante INT, Cantidad INT, Monto DECIMAL(12,2));
        INSERT INTO @Montos (IDPedidoDetalle, IDVariante, Cantidad, Monto)
        SELECT d.IDPedidoDetalle, d.IDVariante, p.Cantidad,
               CAST(ROUND((d.Cantidad * d.PrecioUnitario - d.Descuento) * (d.CantidadDevuelta + p.Cantidad) / d.Cantidad, 2)
                  - ROUND((d.Cantidad * d.PrecioUnitario - d.Descuento) * d.CantidadDevuelta / d.Cantidad, 2) AS DECIMAL(12,2))
        FROM @Pedir p JOIN dbo.PedidoDetalle d ON d.IDPedidoDetalle = p.IDPedidoDetalle;

        SELECT @Monto = SUM(Monto) FROM @Montos;

        INSERT INTO dbo.Devoluciones (IDPedido, IDUsuario, Motivo, Monto)
        VALUES (@IDPedido, @IDUsuario, LTRIM(RTRIM(@Motivo)), @Monto);
        SET @IDDevolucion = SCOPE_IDENTITY();

        INSERT INTO dbo.DevolucionDetalle (IDDevolucion, IDPedidoDetalle, Cantidad, Monto)
        SELECT @IDDevolucion, IDPedidoDetalle, Cantidad, Monto FROM @Montos;

        UPDATE d SET CantidadDevuelta = d.CantidadDevuelta + m.Cantidad
        FROM dbo.PedidoDetalle d JOIN @Montos m ON m.IDPedidoDetalle = d.IDPedidoDetalle;

        DECLARE @IDVariante INT = 0, @Cantidad INT,
                @MotivoKardex NVARCHAR(300) = N'Devolución #' + CAST(@IDDevolucion AS NVARCHAR(10)) + N', pedido #' + CAST(@IDPedido AS NVARCHAR(10));
        WHILE 1 = 1
        BEGIN
            SELECT TOP (1) @IDVariante = IDVariante, @Cantidad = Cantidad
            FROM @Montos WHERE IDVariante > @IDVariante ORDER BY IDVariante;
            IF @@ROWCOUNT = 0 BREAK;

            EXEC dbo.SP_Inventario_RegistrarMovimiento
                @IDVariante = @IDVariante, @Tipo = N'Devolucion', @Cantidad = @Cantidad,
                @Motivo = @MotivoKardex, @IDUsuario = @IDUsuario, @IDPedido = @IDPedido;
        END;

        SET @NuevoEstado = CASE WHEN EXISTS (SELECT 1 FROM dbo.PedidoDetalle WHERE IDPedido = @IDPedido AND CantidadDevuelta < Cantidad)
                                THEN N'DevueltoParcial' ELSE N'Devuelto' END;

        IF @NuevoEstado <> @Estado
        BEGIN
            UPDATE dbo.Pedidos SET Estado = @NuevoEstado, FechaActualizacion = SYSUTCDATETIME() WHERE IDPedido = @IDPedido;
            INSERT INTO dbo.PedidoHistorial (IDPedido, EstadoAnterior, EstadoNuevo, IDUsuario, Comentario)
            VALUES (@IDPedido, @Estado, @NuevoEstado, @IDUsuario, LTRIM(RTRIM(@Motivo)));
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Devoluciones_ListarPorPedido @IDUsuario = @IDUsuario, @IDPedido = @IDPedido;
END;
GO

-- Devoluciones de un pedido. El Cliente solo consulta las de sus pedidos.
CREATE OR ALTER PROCEDURE dbo.SP_Devoluciones_ListarPorPedido
    @IDUsuario INT,
    @IDPedido  INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Rol NVARCHAR(20) = dbo.FU_Auth_Rol(@IDUsuario);
    IF @Rol IS NULL THROW 52403, N'Usuario no autorizado.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Pedidos WHERE IDPedido = @IDPedido AND (@Rol <> N'Cliente' OR IDUsuario = @IDUsuario))
        THROW 52404, N'El pedido no existe.', 1;

    SELECT IDDevolucion, IDPedido, IDUsuario, Motivo, Monto, Fecha
    FROM dbo.Devoluciones WHERE IDPedido = @IDPedido ORDER BY IDDevolucion;

    SELECT dd.IDDevolucion, dd.IDPedidoDetalle, v.SKU, dd.Cantidad, dd.Monto
    FROM dbo.DevolucionDetalle dd
    JOIN dbo.Devoluciones dv ON dv.IDDevolucion = dd.IDDevolucion
    JOIN dbo.PedidoDetalle pd ON pd.IDPedidoDetalle = dd.IDPedidoDetalle
    JOIN dbo.Variantes v ON v.IDVariante = pd.IDVariante
    WHERE dv.IDPedido = @IDPedido
    ORDER BY dd.IDDevolucion, dd.IDPedidoDetalle;
END;
GO
