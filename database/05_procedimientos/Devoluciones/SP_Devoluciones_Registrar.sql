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
