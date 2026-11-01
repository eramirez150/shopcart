-- Desactiva una dirección del usuario (no se borra: puede estar en reservas y pedidos).
-- La de otro usuario responde como inexistente (404).
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Desactivar
    @IDUsuario   INT,
    @IDDireccion INT
AS
BEGIN
    SET NOCOUNT ON;

    IF dbo.FU_Auth_Rol(@IDUsuario) IS NULL THROW 52403, N'Usuario no autorizado.', 1;

    UPDATE dbo.Direcciones SET Activa = 0
    WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario AND Activa = 1;

    IF @@ROWCOUNT = 0 THROW 52404, N'La dirección no existe.', 1;

    SELECT IDDireccion, Direccion, Ciudad, Telefono, Activa, FechaCreacion
    FROM dbo.Direcciones WHERE IDDireccion = @IDDireccion;
END;
GO
