CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearProducto
    @IDUsuario   INT,
    @IDCategoria INT,
    @Nombre      NVARCHAR(150),
    @Descripcion NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'catalogo.gestionar') = 0
        THROW 52403, N'No tiene permiso para gestionar el catálogo.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria AND Activa = 1)
        THROW 52404, N'La categoría no existe o está desactivada.', 1;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;
    INSERT INTO dbo.Productos (IDCategoria, Nombre, Descripcion) VALUES (@IDCategoria, LTRIM(RTRIM(@Nombre)), @Descripcion);

    DECLARE @IDProducto INT = SCOPE_IDENTITY();
    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto = @IDProducto, @IncluirInactivos = 1;
END;
GO
