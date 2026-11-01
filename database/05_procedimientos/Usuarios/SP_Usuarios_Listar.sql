-- Usuarios paginados (Administrador), filtrables por rol.
-- @Orden: id (por defecto), nombre, correo o recientes. El orden usa CASE.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Listar
    @IDUsuario INT,
    @Rol       NVARCHAR(20) = NULL,
    @Orden     NVARCHAR(20) = N'id',
    @Pagina    INT = 1,
    @Tamano    INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF dbo.FU_Auth_Rol(@IDUsuario) IS NULL OR dbo.FU_Auth_Rol(@IDUsuario) <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona usuarios.', 1;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;
    IF @Orden NOT IN (N'id', N'nombre', N'correo', N'recientes')
        THROW 52400, N'Orden inválido. Use id, nombre, correo o recientes.', 1;

    SELECT IDUsuario, Correo, Nombre, Rol, Activo, FechaCreacion, COUNT(*) OVER () AS TotalFilas
    FROM dbo.Usuarios
    WHERE @Rol IS NULL OR Rol = @Rol
    ORDER BY
        CASE WHEN @Orden = N'nombre'    THEN Nombre END ASC,
        CASE WHEN @Orden = N'correo'    THEN Correo END ASC,
        CASE WHEN @Orden = N'recientes' THEN IDUsuario END DESC,
        IDUsuario
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO
