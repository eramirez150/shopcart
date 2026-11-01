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
