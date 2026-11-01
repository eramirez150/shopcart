-- Rol de un usuario activo. Devuelve NULL si no existe o está desactivado.
CREATE OR ALTER FUNCTION dbo.FU_Auth_Rol (@IDUsuario INT)
RETURNS NVARCHAR(20)
AS
BEGIN
    RETURN (SELECT Rol FROM dbo.Usuarios WHERE IDUsuario = @IDUsuario AND Activo = 1);
END;
GO
