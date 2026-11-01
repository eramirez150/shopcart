CREATE OR ALTER PROCEDURE dbo.SP_Auth_Registrar
    @Correo    NVARCHAR(150),
    @ClaveHash NVARCHAR(100),
    @Nombre    NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Correo = LOWER(LTRIM(RTRIM(@Correo)));
    IF EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Correo = @Correo)
        THROW 52409, N'El correo ya está registrado.', 1;

    INSERT INTO dbo.Usuarios (Correo, ClaveHash, Nombre, Rol)
    VALUES (@Correo, @ClaveHash, LTRIM(RTRIM(@Nombre)), N'Cliente');

    SELECT IDUsuario, Correo, Nombre, Rol, Activo
    FROM dbo.Usuarios WHERE IDUsuario = SCOPE_IDENTITY();
END;
GO
