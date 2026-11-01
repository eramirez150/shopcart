-- Agrega una imagen a un producto (Administrador). Devuelve el producto completo.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_AgregarImagen
    @IDUsuario        INT,
    @IDProducto       INT,
    @Url              NVARCHAR(500),
    @TextoAlternativo NVARCHAR(150) = NULL,
    @Orden            INT = 0
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona el catálogo.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE IDProducto = @IDProducto)
        THROW 52404, N'El producto no existe.', 1;
    IF @Url IS NULL OR (LTRIM(@Url) NOT LIKE N'https://%' AND LTRIM(@Url) NOT LIKE N'http://%')
        THROW 52400, N'La URL de la imagen debe empezar con http:// o https://.', 1;
    IF @Orden IS NULL OR @Orden < 0 THROW 52400, N'El orden no puede ser negativo.', 1;

    INSERT INTO dbo.ProductoImagenes (IDProducto, Url, TextoAlternativo, Orden)
    VALUES (@IDProducto, LTRIM(RTRIM(@Url)), NULLIF(LTRIM(RTRIM(@TextoAlternativo)), N''), @Orden);

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto = @IDProducto, @IncluirInactivos = 1;
END;
GO
