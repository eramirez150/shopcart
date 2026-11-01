-- Movimiento manual del Operador o del Administrador.
-- Entrada y Salida reciben la cantidad en positivo; Ajuste lleva signo.
-- Una salida o un ajuste negativo no puede dejar la existencia por debajo de lo
-- reservado por pagos en curso (reservas activas y no vencidas): esa existencia
-- ya está prometida a un cliente. La variante se bloquea antes de revisar, igual
-- que en SP_Checkout_IniciarPago, para que nadie reserve entre la revisión y el cambio.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_Registrar
    @IDUsuario  INT,
    @IDVariante INT,
    @Tipo       NVARCHAR(12),
    @Cantidad   INT,
    @Motivo     NVARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') NOT IN (N'Operador', N'Administrador')
        THROW 52403, N'No tiene permiso para registrar movimientos de inventario.', 1;
    IF @Tipo NOT IN (N'Entrada', N'Salida', N'Ajuste')
        THROW 52400, N'El tipo debe ser Entrada, Salida o Ajuste.', 1;
    IF @Tipo <> N'Ajuste' AND @Cantidad <= 0
        THROW 52400, N'La cantidad debe ser mayor que cero.', 1;

    DECLARE @Firmada INT = CASE WHEN @Tipo = N'Salida' THEN -@Cantidad ELSE @Cantidad END;
    DECLARE @IDKardex INT, @Existencia INT, @Reservado INT, @Mensaje NVARCHAR(300);

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @Existencia = Existencia
        FROM dbo.Variantes WITH (UPDLOCK, HOLDLOCK)
        WHERE IDVariante = @IDVariante;

        IF @Existencia IS NULL THROW 52404, N'La variante no existe.', 1;

        IF @Firmada < 0
        BEGIN
            SET @Reservado = (SELECT Reservado FROM dbo.FU_Inventario_Disponibilidad() WHERE IDVariante = @IDVariante);
            IF @Reservado > 0 AND @Existencia + @Firmada < @Reservado
            BEGIN
                SET @Mensaje = N'El movimiento dejaría la existencia en ' + CAST(@Existencia + @Firmada AS NVARCHAR(10))
                             + N', por debajo de las ' + CAST(@Reservado AS NVARCHAR(10))
                             + N' unidades reservadas por pagos en curso. Máximo a retirar: '
                             + CAST(@Existencia - @Reservado AS NVARCHAR(10)) + N'.';
                THROW 52409, @Mensaje, 1;
            END;
        END;

        EXEC dbo.SP_Inventario_RegistrarMovimiento
            @IDVariante = @IDVariante, @Tipo = @Tipo, @Cantidad = @Firmada,
            @Motivo = @Motivo, @IDUsuario = @IDUsuario, @IDKardex = @IDKardex OUTPUT;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    SELECT IDKardex, IDVariante, Tipo, Cantidad, ExistenciaResultante, Motivo, Fecha
    FROM dbo.Kardex WHERE IDKardex = @IDKardex;
END;
GO
