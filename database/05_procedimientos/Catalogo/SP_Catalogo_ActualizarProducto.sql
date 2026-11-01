CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarProducto
    @IDUsuario   INT,
    @IDProducto  INT,
    @IDCategoria INT,
    @Nombre      NVARCHAR(150),
    @Descripcion NVARCHAR(1000) = NULL,
    @Activo      BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona el catálogo.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE IDProducto = @IDProducto)
        THROW 52404, N'El producto no existe.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria)
        THROW 52404, N'La categoría no existe.', 1;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;
    UPDATE dbo.Productos
    SET IDCategoria = @IDCategoria, Nombre = LTRIM(RTRIM(@Nombre)), Descripcion = @Descripcion, Activo = @Activo
    WHERE IDProducto = @IDProducto;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto = @IDProducto, @IncluirInactivos = 1;
END;
GO
