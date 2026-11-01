-- Convierte una reserva activa en pedido. Pedido, detalle, kardex, uso del cupón
-- e historial se guardan en una sola transacción.
-- El bloqueo de la fila de la reserva serializa los reintentos: el segundo
-- llamado espera, encuentra el pedido ya creado y lo devuelve (IDReserva es UNIQUE).
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CrearPedido
    @IDUsuario INT,
    @IDReserva INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF dbo.FU_Auth_Rol(@IDUsuario) IS NULL THROW 52403, N'Usuario no autorizado.', 1;

    DECLARE @IDPedido INT, @Estado NVARCHAR(10), @Expira DATETIME2(0), @IDCupon INT,
            @IDCarrito INT, @Subtotal DECIMAL(12,2), @Descuento DECIMAL(12,2), @Total DECIMAL(12,2),
            @Direccion NVARCHAR(300), @Ciudad NVARCHAR(100), @Telefono NVARCHAR(20);

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @Estado = Estado, @Expira = Expira, @IDCupon = IDCupon, @IDCarrito = IDCarrito,
               @Subtotal = Subtotal, @Descuento = Descuento, @Total = Total,
               @Direccion = Direccion, @Ciudad = Ciudad, @Telefono = Telefono
        FROM dbo.Reservas WITH (UPDLOCK, HOLDLOCK)
        WHERE IDReserva = @IDReserva AND IDUsuario = @IDUsuario;

        IF @Estado IS NULL THROW 52404, N'La reserva no existe.', 1;

        SELECT @IDPedido = IDPedido FROM dbo.Pedidos WHERE IDReserva = @IDReserva;

        IF @IDPedido IS NULL
        BEGIN
            IF @Estado <> N'Activa' THROW 52409, N'La reserva ya no está activa.', 1;
            IF @Expira <= SYSUTCDATETIME() THROW 52409, N'La reserva venció. Inicie el pago de nuevo.', 1;

            EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

            -- Bloqueo de variantes en orden fijo. Nadie más pudo tomar esta existencia
            -- porque la reserva activa ya la restaba del disponible.
            DECLARE @Lineas TABLE (IDVariante INT PRIMARY KEY, Cantidad INT, Existencia INT);
            INSERT INTO @Lineas (IDVariante, Cantidad, Existencia)
            SELECT rd.IDVariante, rd.Cantidad, v.Existencia
            FROM dbo.ReservaDetalle rd
            JOIN dbo.Variantes v WITH (UPDLOCK, HOLDLOCK) ON v.IDVariante = rd.IDVariante
            WHERE rd.IDReserva = @IDReserva
            ORDER BY rd.IDVariante;

            IF EXISTS (SELECT 1 FROM @Lineas WHERE Existencia < Cantidad)
                THROW 52409, N'La existencia ya no alcanza para el pedido.', 1;

            INSERT INTO dbo.Pedidos (IDUsuario, IDReserva, Estado, IDCupon, Subtotal, Descuento, Total, IVA,
                                     Direccion, Ciudad, Telefono, ReferenciaPago)
            VALUES (@IDUsuario, @IDReserva, N'Pagado', @IDCupon, @Subtotal, @Descuento, @Total,
                    ROUND(@Total - @Total / 1.12, 2),   -- los precios ya incluyen el IVA de 12 %
                    @Direccion, @Ciudad, @Telefono, N'SIM-' + CONVERT(NVARCHAR(36), NEWID()));

            SET @IDPedido = SCOPE_IDENTITY();

            INSERT INTO dbo.PedidoDetalle (IDPedido, IDVariante, Cantidad, PrecioUnitario, Descuento)
            SELECT @IDPedido, IDVariante, Cantidad, PrecioUnitario, Descuento
            FROM dbo.ReservaDetalle WHERE IDReserva = @IDReserva;

            -- Salida de kardex por línea, en orden de IDVariante.
            DECLARE @IDVariante INT = 0, @Cantidad INT, @Motivo NVARCHAR(300) = N'Venta, pedido #' + CAST(@IDPedido AS NVARCHAR(10));
            WHILE 1 = 1
            BEGIN
                SELECT TOP (1) @IDVariante = IDVariante, @Cantidad = -Cantidad
                FROM @Lineas WHERE IDVariante > @IDVariante ORDER BY IDVariante;
                IF @@ROWCOUNT = 0 BREAK;

                EXEC dbo.SP_Inventario_RegistrarMovimiento
                    @IDVariante = @IDVariante, @Tipo = N'Salida', @Cantidad = @Cantidad,
                    @Motivo = @Motivo, @IDUsuario = @IDUsuario, @IDPedido = @IDPedido;
            END;

            IF @IDCupon IS NOT NULL
                EXEC dbo.SP_Cupones_RegistrarUso @IDCupon = @IDCupon, @IDUsuario = @IDUsuario, @IDPedido = @IDPedido;

            UPDATE dbo.Reservas SET Estado = N'Consumida' WHERE IDReserva = @IDReserva;
            UPDATE dbo.Carritos SET Estado = N'Convertido', FechaActualizacion = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;

            INSERT INTO dbo.PedidoHistorial (IDPedido, EstadoAnterior, EstadoNuevo, IDUsuario, Comentario)
            VALUES (@IDPedido, NULL, N'Pagado', @IDUsuario, N'Pedido creado');
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Pedidos_Obtener @IDUsuario = @IDUsuario, @IDPedido = @IDPedido;
END;
GO
