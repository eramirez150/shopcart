-- Autenticación y usuarios. El hash de la contraseña lo calcula la API (bcrypt);
-- la base solo lo guarda. Del refresh token solo se guarda su SHA-256.

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

CREATE OR ALTER PROCEDURE dbo.SP_Auth_GuardarRefresh
    @IDUsuario INT,
    @TokenHash CHAR(64),
    @Expira    DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.RefreshTokens (IDUsuario, TokenHash, Expira) VALUES (@IDUsuario, @TokenHash, @Expira);
END;
GO

-- Rotación: el token recibido se revoca y se crea uno nuevo, en una transacción.
-- Si llega un token ya revocado se asume robo: se revocan todos los del usuario.
-- La revocación se confirma antes de devolver el error, por eso el THROW va al final.
CREATE OR ALTER PROCEDURE dbo.SP_Auth_RotarRefresh
    @TokenHash      CHAR(64),
    @NuevoTokenHash CHAR(64),
    @NuevaExpira    DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDUsuario INT, @Expira DATETIME2(0), @Revocado DATETIME2(0), @Mensaje NVARCHAR(200) = NULL;

    BEGIN TRANSACTION;

    SELECT @IDUsuario = IDUsuario, @Expira = Expira, @Revocado = FechaRevocado
    FROM dbo.RefreshTokens WITH (UPDLOCK, HOLDLOCK)
    WHERE TokenHash = @TokenHash;

    IF @IDUsuario IS NULL
        SET @Mensaje = N'Refresh token inválido.';
    ELSE IF @Revocado IS NOT NULL
    BEGIN
        UPDATE dbo.RefreshTokens SET FechaRevocado = SYSUTCDATETIME()
        WHERE IDUsuario = @IDUsuario AND FechaRevocado IS NULL;
        SET @Mensaje = N'Refresh token reutilizado: se cerraron las sesiones del usuario.';
    END
    ELSE IF @Expira <= SYSUTCDATETIME()
        SET @Mensaje = N'Refresh token vencido.';
    ELSE IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE IDUsuario = @IDUsuario AND Activo = 1)
        SET @Mensaje = N'El usuario está desactivado.';
    ELSE
    BEGIN
        UPDATE dbo.RefreshTokens SET FechaRevocado = SYSUTCDATETIME() WHERE TokenHash = @TokenHash;
        INSERT INTO dbo.RefreshTokens (IDUsuario, TokenHash, Expira) VALUES (@IDUsuario, @NuevoTokenHash, @NuevaExpira);
    END;

    COMMIT TRANSACTION;

    IF @Mensaje IS NOT NULL THROW 52401, @Mensaje, 1;

    SELECT IDUsuario, Correo, Nombre, Rol FROM dbo.Usuarios WHERE IDUsuario = @IDUsuario;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Auth_RevocarRefresh
    @TokenHash CHAR(64)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.RefreshTokens SET FechaRevocado = SYSUTCDATETIME()
    WHERE TokenHash = @TokenHash AND FechaRevocado IS NULL;
END;
GO

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

CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Listar
    @IDUsuario INT,
    @Rol       NVARCHAR(20) = NULL,
    @Pagina    INT = 1,
    @Tamano    INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF dbo.FU_Auth_Rol(@IDUsuario) IS NULL OR dbo.FU_Auth_Rol(@IDUsuario) <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona usuarios.', 1;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;

    SELECT IDUsuario, Correo, Nombre, Rol, Activo, FechaCreacion, COUNT(*) OVER () AS TotalFilas
    FROM dbo.Usuarios
    WHERE @Rol IS NULL OR Rol = @Rol
    ORDER BY IDUsuario
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO

-- Cambia el rol o el estado activo de un usuario. Nunca se borra. Al desactivarlo
-- se cierran sus sesiones. Un administrador no puede desactivarse a sí mismo.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Actualizar
    @IDUsuario  INT,
    @IDObjetivo INT,
    @Rol        NVARCHAR(20) = NULL,
    @Activo     BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF dbo.FU_Auth_Rol(@IDUsuario) IS NULL OR dbo.FU_Auth_Rol(@IDUsuario) <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona usuarios.', 1;
    IF @Rol IS NOT NULL AND @Rol NOT IN (N'Cliente', N'Operador', N'Administrador')
        THROW 52400, N'Rol inválido.', 1;
    IF @IDUsuario = @IDObjetivo AND (@Activo = 0 OR (@Rol IS NOT NULL AND @Rol <> N'Administrador'))
        THROW 52409, N'Un administrador no puede quitarse su propio acceso.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE IDUsuario = @IDObjetivo)
        THROW 52404, N'El usuario no existe.', 1;

    BEGIN TRANSACTION;
    UPDATE dbo.Usuarios
    SET Rol = ISNULL(@Rol, Rol), Activo = ISNULL(@Activo, Activo)
    WHERE IDUsuario = @IDObjetivo;

    IF @Activo = 0
        UPDATE dbo.RefreshTokens SET FechaRevocado = SYSUTCDATETIME()
        WHERE IDUsuario = @IDObjetivo AND FechaRevocado IS NULL;
    COMMIT TRANSACTION;

    SELECT IDUsuario, Correo, Nombre, Rol, Activo FROM dbo.Usuarios WHERE IDUsuario = @IDObjetivo;
END;
GO
