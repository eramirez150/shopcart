-- Movimiento manual del Operador o del Administrador.
-- Entrada y Salida reciben la cantidad en positivo; Ajuste lleva signo.
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

    DECLARE @IDKardex INT;
    EXEC dbo.SP_Inventario_RegistrarMovimiento
        @IDVariante = @IDVariante, @Tipo = @Tipo, @Cantidad = @Firmada,
        @Motivo = @Motivo, @IDUsuario = @IDUsuario, @IDKardex = @IDKardex OUTPUT;

    SELECT IDKardex, IDVariante, Tipo, Cantidad, ExistenciaResultante, Motivo, Fecha
    FROM dbo.Kardex WHERE IDKardex = @IDKardex;
END;
GO
