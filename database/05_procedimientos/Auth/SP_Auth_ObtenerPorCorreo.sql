-- Devuelve el hash para que la API compare la contraseña. Sin resultado si no existe.
CREATE OR ALTER PROCEDURE dbo.SP_Auth_ObtenerPorCorreo
    @Correo NVARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT IDUsuario, Correo, ClaveHash, Nombre, Rol, Activo
    FROM dbo.Usuarios WHERE Correo = LOWER(LTRIM(RTRIM(@Correo)));
END;
GO
