-- Al cancelar un pedido el uso del cupón se devuelve. Una devolución no lo devuelve.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_AnularUso
    @IDPedido INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @@TRANCOUNT = 0 THROW 52500, N'Debe ejecutarse dentro de una transacción.', 1;

    DECLARE @IDCupon INT;
    UPDATE dbo.CuponUsos SET Anulado = 1, @IDCupon = IDCupon
    WHERE IDPedido = @IDPedido AND Anulado = 0;

    IF @IDCupon IS NOT NULL
        UPDATE dbo.Cupones SET Usos = Usos - 1 WHERE IDCupon = @IDCupon;
END;
GO
