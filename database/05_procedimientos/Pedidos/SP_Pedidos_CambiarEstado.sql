-- Cambio de estado por las transiciones de PedidoTransiciones.
-- El personal con pedidos.gestionar avanza o cancela cualquier pedido; el Cliente
-- solo cancela los suyos. Los estados de devolución se alcanzan con
-- SP_Devoluciones_Registrar. Cancelar reintegra la existencia por kardex y
-- devuelve el uso del cupón. Pasar a Despachado exige mensajería, guía, peso y costo
-- de recogida; pasar a Entregado exige quién recibió. Esos datos se guardan en
-- PedidoEnvios en la misma transacción que el cambio de estado.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CambiarEstado
    @IDUsuario   INT,
    @IDPedido    INT,
    @EstadoNuevo NVARCHAR(20),
    @Comentario  NVARCHAR(300) = NULL,
    @Mensajeria    NVARCHAR(100) = NULL,
    @Guia          NVARCHAR(60)  = NULL,
    @PesoKg        DECIMAL(8,2)  = NULL,
    @CostoRecogida DECIMAL(12,2) = NULL,
    @RecibidoPor   NVARCHAR(150) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Rol NVARCHAR(20) = dbo.FU_Auth_Rol(@IDUsuario);
    IF @Rol IS NULL THROW 52403, N'Usuario no autorizado.', 1;
    IF @Rol <> N'Cliente' AND dbo.FU_Auth_TienePermiso(@IDUsuario, N'pedidos.gestionar') = 0
        THROW 52403, N'No tiene permiso para gestionar pedidos.', 1;

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

        IF @EstadoNuevo = N'Despachado'
           AND (NULLIF(LTRIM(RTRIM(@Mensajeria)), N'') IS NULL OR NULLIF(LTRIM(RTRIM(@Guia)), N'') IS NULL
                OR @PesoKg IS NULL OR @PesoKg <= 0 OR @CostoRecogida IS NULL OR @CostoRecogida < 0)
            THROW 52400, N'Para despachar se requieren mensajería, guía, peso mayor que cero y costo de recogida.', 1;
        IF @EstadoNuevo = N'Entregado' AND NULLIF(LTRIM(RTRIM(@RecibidoPor)), N'') IS NULL
            THROW 52400, N'Para entregar se requiere quién recibió el pedido.', 1;

        EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

        UPDATE dbo.Pedidos SET Estado = @EstadoNuevo, FechaActualizacion = SYSUTCDATETIME()
        WHERE IDPedido = @IDPedido;

        INSERT INTO dbo.PedidoHistorial (IDPedido, EstadoAnterior, EstadoNuevo, IDUsuario, Comentario)
        VALUES (@IDPedido, @Estado, @EstadoNuevo, @IDUsuario, @Comentario);

        IF @EstadoNuevo = N'Despachado'
            INSERT INTO dbo.PedidoEnvios (IDPedido, Mensajeria, Guia, PesoKg, CostoRecogida)
            VALUES (@IDPedido, LTRIM(RTRIM(@Mensajeria)), LTRIM(RTRIM(@Guia)), @PesoKg, @CostoRecogida);

        IF @EstadoNuevo = N'Entregado'
        BEGIN
            UPDATE dbo.PedidoEnvios SET RecibidoPor = LTRIM(RTRIM(@RecibidoPor)), FechaEntrega = SYSUTCDATETIME()
            WHERE IDPedido = @IDPedido;
            IF @@ROWCOUNT = 0 THROW 52409, N'El pedido no tiene datos de despacho.', 1;
        END;

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
