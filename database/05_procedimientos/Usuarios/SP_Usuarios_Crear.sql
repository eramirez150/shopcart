-- Gestión de usuarios (permiso usuarios.gestionar). El rol debe existir y estar activo;
-- se guarda con su nombre exacto. Solo el Administrador asigna roles de empleado: quien
-- crea un usuario elige su clave y podría entrar con más permisos que los suyos.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Crear
    @IDUsuario INT,
    @Correo    NVARCHAR(150),
    @ClaveHash NVARCHAR(100),
    @Nombre    NVARCHAR(100),
    @Rol       NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'usuarios.gestionar') = 0
        THROW 52403, N'No tiene permiso para gestionar usuarios.', 1;

    SET @Rol = (SELECT Nombre FROM dbo.Roles WHERE Nombre = @Rol AND Activo = 1);
    IF @Rol IS NULL THROW 52400, N'Rol inválido o inactivo.', 1;
    IF @Rol <> N'Cliente' AND dbo.FU_Auth_TienePermiso(@IDUsuario, N'roles.gestionar') = 0
        THROW 52403, N'Solo el Administrador asigna roles de empleado.', 1;

    SET @Correo = LOWER(LTRIM(RTRIM(@Correo)));
    IF EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Correo = @Correo)
        THROW 52409, N'El correo ya está registrado.', 1;

    INSERT INTO dbo.Usuarios (Correo, ClaveHash, Nombre, Rol)
    VALUES (@Correo, @ClaveHash, LTRIM(RTRIM(@Nombre)), @Rol);

    SELECT IDUsuario, Correo, Nombre, Rol, Activo FROM dbo.Usuarios WHERE IDUsuario = SCOPE_IDENTITY();
END;
GO
