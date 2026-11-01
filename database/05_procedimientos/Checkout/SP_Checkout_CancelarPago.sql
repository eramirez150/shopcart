-- Cancela el pago: la reserva activa se anula y su existencia queda libre.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_CancelarPago
    @IDUsuario INT,
    @IDReserva INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Reservas SET Estado = N'Anulada'
    WHERE IDReserva = @IDReserva AND IDUsuario = @IDUsuario AND Estado = N'Activa';

    IF @@ROWCOUNT = 0
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.Reservas WHERE IDReserva = @IDReserva AND IDUsuario = @IDUsuario)
            THROW 52404, N'La reserva no existe.', 1;
        THROW 52409, N'La reserva ya no está activa.', 1;
    END;

    EXEC dbo.SP_Checkout_ObtenerReserva @IDUsuario = @IDUsuario, @IDReserva = @IDReserva;
END;
GO
