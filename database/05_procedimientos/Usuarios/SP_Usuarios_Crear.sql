-- Gestión de usuarios (Administrador).
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Crear
    @IDUsuario INT,
    @Correo    NVARCHAR(150),
    @ClaveHash NVARCHAR(100),
    @Nombre    NVARCHAR(100),
    @Rol       NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    IF dbo.FU_Auth_Rol(@IDUsuario) IS NULL OR dbo.FU_Auth_Rol(@IDUsuario) <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona usuarios.', 1;
    IF @Rol NOT IN (N'Cliente', N'Operador', N'Administrador')
        THROW 52400, N'Rol inválido.', 1;

    SET @Correo = LOWER(LTRIM(RTRIM(@Correo)));
    IF EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Correo = @Correo)
        THROW 52409, N'El correo ya está registrado.', 1;

    INSERT INTO dbo.Usuarios (Correo, ClaveHash, Nombre, Rol)
    VALUES (@Correo, @ClaveHash, LTRIM(RTRIM(@Nombre)), @Rol);

    SELECT IDUsuario, Correo, Nombre, Rol, Activo FROM dbo.Usuarios WHERE IDUsuario = SCOPE_IDENTITY();
END;
GO
