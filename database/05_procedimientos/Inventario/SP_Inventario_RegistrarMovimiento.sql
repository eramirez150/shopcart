-- Único punto que cambia la existencia: actualiza Variantes y escribe el kardex
-- en la misma transacción, así la existencia siempre es la suma del kardex.
-- @Cantidad lleva signo (positiva entra, negativa sale). Si no hay una
-- transacción abierta, abre una propia.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_RegistrarMovimiento
    @IDVariante INT,
    @Tipo       NVARCHAR(12),
    @Cantidad   INT,
    @Motivo     NVARCHAR(300),
    @IDUsuario  INT = NULL,
    @IDPedido   INT = NULL,
    @IDKardex   INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Tipo NOT IN (N'Entrada', N'Salida', N'Ajuste', N'Devolucion')
        THROW 52400, N'Tipo de movimiento inválido.', 1;
    IF @Cantidad = 0
        THROW 52400, N'La cantidad no puede ser cero.', 1;
    IF @Motivo IS NULL OR LEN(LTRIM(RTRIM(@Motivo))) = 0
        THROW 52400, N'El motivo es obligatorio.', 1;
    IF (@Tipo IN (N'Entrada', N'Devolucion') AND @Cantidad < 0) OR (@Tipo = N'Salida' AND @Cantidad > 0)
        THROW 52400, N'El signo de la cantidad no corresponde al tipo de movimiento.', 1;

    DECLARE @propia BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;
    DECLARE @Existencia INT;

    BEGIN TRY
        IF @propia = 1 BEGIN TRANSACTION;

        EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

        -- El bloqueo evita que dos movimientos lean la misma existencia.
        SELECT @Existencia = Existencia
        FROM dbo.Variantes WITH (UPDLOCK, HOLDLOCK)
        WHERE IDVariante = @IDVariante;

        IF @Existencia IS NULL
            THROW 52404, N'La variante no existe.', 1;
        IF @Existencia + @Cantidad < 0
            THROW 52409, N'La existencia no puede quedar en negativo.', 1;

        SET @Existencia = @Existencia + @Cantidad;

        UPDATE dbo.Variantes SET Existencia = @Existencia WHERE IDVariante = @IDVariante;

        INSERT INTO dbo.Kardex (IDVariante, Tipo, Cantidad, ExistenciaResultante, Motivo, IDUsuario, IDPedido)
        VALUES (@IDVariante, @Tipo, @Cantidad, @Existencia, LTRIM(RTRIM(@Motivo)), @IDUsuario, @IDPedido);
        SET @IDKardex = SCOPE_IDENTITY();

        IF @propia = 1 COMMIT TRANSACTION;

    END TRY
    BEGIN CATCH
        IF @propia = 1 AND @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
