-- Consume un uso dentro de la transacción del pedido. El UPDATE condicionado
-- toma el bloqueo de la fila del cupón, así los pedidos que usan el mismo cupón
-- se serializan y el límite total y el límite por cliente se revisan sin carreras.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_RegistrarUso
    @IDCupon   INT,
    @IDUsuario INT,
    @IDPedido  INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @@TRANCOUNT = 0 THROW 52500, N'El uso de un cupón debe registrarse dentro de la transacción del pedido.', 1;

    UPDATE dbo.Cupones
    SET Usos = Usos + 1
    WHERE IDCupon = @IDCupon AND Activo = 1 AND (LimiteTotal IS NULL OR Usos < LimiteTotal);

    IF @@ROWCOUNT = 0
        THROW 52409, N'El cupón ya no está disponible: alcanzó su límite total o fue desactivado.', 1;

    DECLARE @LimiteCliente INT = (SELECT LimitePorCliente FROM dbo.Cupones WHERE IDCupon = @IDCupon);
    IF @LimiteCliente IS NOT NULL AND
       (SELECT COUNT(*) FROM dbo.CuponUsos WHERE IDCupon = @IDCupon AND IDUsuario = @IDUsuario AND Anulado = 0) >= @LimiteCliente
        THROW 52409, N'Ya usó este cupón el máximo de veces permitido.', 1;

    INSERT INTO dbo.CuponUsos (IDCupon, IDUsuario, IDPedido) VALUES (@IDCupon, @IDUsuario, @IDPedido);
END;
GO
