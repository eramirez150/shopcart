-- Direcciones activas del usuario autenticado. Nunca devuelve las de otro usuario.
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Listar
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    IF dbo.FU_Auth_Rol(@IDUsuario) IS NULL THROW 52403, N'Usuario no autorizado.', 1;

    SELECT IDDireccion, Direccion, Ciudad, Telefono, Activa, FechaCreacion
    FROM dbo.Direcciones
    WHERE IDUsuario = @IDUsuario AND Activa = 1
    ORDER BY IDDireccion DESC;
END;
GO
