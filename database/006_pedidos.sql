-- Pedidos: consulta, creación atómica a partir de una reserva y cambio de estado.

-- Pedido con sus líneas e historial. El Cliente solo ve los suyos; el Operador
-- y el Administrador ven todos. Un pedido ajeno responde como inexistente.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_Obtener
    @IDUsuario INT,
    @IDPedido  INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Rol NVARCHAR(20) = dbo.FU_Auth_Rol(@IDUsuario);
    IF @Rol IS NULL THROW 52403, N'Usuario no autorizado.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Pedidos
                   WHERE IDPedido = @IDPedido AND (@Rol <> N'Cliente' OR IDUsuario = @IDUsuario))
        THROW 52404, N'El pedido no existe.', 1;

    SELECT p.IDPedido, p.IDUsuario, u.Nombre AS Cliente, p.Estado, c.Codigo AS Cupon,
           p.Subtotal, p.Descuento, p.Total, p.IVA, p.Direccion, p.Ciudad, p.Telefono,
           p.ReferenciaPago, p.FechaCreacion, p.FechaActualizacion
    FROM dbo.Pedidos p
    JOIN dbo.Usuarios u ON u.IDUsuario = p.IDUsuario
    LEFT JOIN dbo.Cupones c ON c.IDCupon = p.IDCupon
    WHERE p.IDPedido = @IDPedido;

    SELECT d.IDPedidoDetalle, d.IDVariante, v.SKU, pr.Nombre AS Producto, d.Cantidad,
           d.PrecioUnitario, d.Descuento, d.CantidadDevuelta
    FROM dbo.PedidoDetalle d
    JOIN dbo.Variantes v ON v.IDVariante = d.IDVariante
    JOIN dbo.Productos pr ON pr.IDProducto = v.IDProducto
    WHERE d.IDPedido = @IDPedido
    ORDER BY d.IDPedidoDetalle;

    SELECT h.EstadoAnterior, h.EstadoNuevo, h.IDUsuario, us.Nombre AS Usuario, h.Comentario, h.Fecha
    FROM dbo.PedidoHistorial h
    JOIN dbo.Usuarios us ON us.IDUsuario = h.IDUsuario
    WHERE h.IDPedido = @IDPedido
    ORDER BY h.IDPedidoHistorial;
END;
GO

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

-- Cambio de estado por las transiciones de PedidoTransiciones.
-- El Operador y el Administrador avanzan o cancelan cualquier pedido; el Cliente
-- solo cancela los suyos. Los estados de devolución se alcanzan con
-- SP_Devoluciones_Registrar. Cancelar reintegra la existencia por kardex y
-- devuelve el uso del cupón.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CambiarEstado
    @IDUsuario   INT,
    @IDPedido    INT,
    @EstadoNuevo NVARCHAR(20),
    @Comentario  NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Rol NVARCHAR(20) = dbo.FU_Auth_Rol(@IDUsuario);
    IF @Rol IS NULL THROW 52403, N'Usuario no autorizado.', 1;

    IF @EstadoNuevo IN (N'DevueltoParcial', N'Devuelto')
        THROW 52400, N'Los estados de devolución se alcanzan registrando una devolución.', 1;

    DECLARE @Estado NVARCHAR(20), @IDCliente INT;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @Estado = Estado, @IDCliente = IDUsuario
        FROM dbo.Pedidos WITH (UPDLOCK, HOLDLOCK)
        WHERE IDPedido = @IDPedido;

        IF @Estado IS NULL OR (@Rol = N'Cliente' AND @IDCliente <> @IDUsuario)
            THROW 52404, N'El pedido no existe.', 1;
        IF @Rol = N'Cliente' AND @EstadoNuevo <> N'Cancelado'
            THROW 52403, N'El cliente solo puede cancelar su pedido.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.PedidoTransiciones WHERE EstadoOrigen = @Estado AND EstadoDestino = @EstadoNuevo)
            THROW 52409, N'Transición de estado no permitida.', 1;

        EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

        UPDATE dbo.Pedidos SET Estado = @EstadoNuevo, FechaActualizacion = SYSUTCDATETIME()
        WHERE IDPedido = @IDPedido;

        INSERT INTO dbo.PedidoHistorial (IDPedido, EstadoAnterior, EstadoNuevo, IDUsuario, Comentario)
        VALUES (@IDPedido, @Estado, @EstadoNuevo, @IDUsuario, @Comentario);

        IF @EstadoNuevo = N'Cancelado'
        BEGIN
            DECLARE @Lineas TABLE (IDVariante INT PRIMARY KEY, Cantidad INT);
            INSERT INTO @Lineas (IDVariante, Cantidad)
            SELECT IDVariante, Cantidad - CantidadDevuelta FROM dbo.PedidoDetalle WHERE IDPedido = @IDPedido;

            DECLARE @IDVariante INT = 0, @Cantidad INT, @Motivo NVARCHAR(300) = N'Cancelación, pedido #' + CAST(@IDPedido AS NVARCHAR(10));
            WHILE 1 = 1
            BEGIN
                SELECT TOP (1) @IDVariante = IDVariante, @Cantidad = Cantidad
                FROM @Lineas WHERE IDVariante > @IDVariante ORDER BY IDVariante;
                IF @@ROWCOUNT = 0 BREAK;

                IF @Cantidad > 0
                    EXEC dbo.SP_Inventario_RegistrarMovimiento
                        @IDVariante = @IDVariante, @Tipo = N'Devolucion', @Cantidad = @Cantidad,
                        @Motivo = @Motivo, @IDUsuario = @IDUsuario, @IDPedido = @IDPedido;
            END;

            EXEC dbo.SP_Cupones_AnularUso @IDPedido = @IDPedido;
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
