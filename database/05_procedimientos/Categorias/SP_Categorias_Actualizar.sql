CREATE OR ALTER PROCEDURE dbo.SP_Categorias_Actualizar
    @IDUsuario   INT,
    @IDCategoria INT,
    @Nombre      NVARCHAR(80),
    @Descripcion NVARCHAR(300) = NULL,
    @Activa      BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'catalogo.gestionar') = 0
        THROW 52403, N'No tiene permiso para gestionar el catálogo.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria)
        THROW 52404, N'La categoría no existe.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = LTRIM(RTRIM(@Nombre)) AND IDCategoria <> @IDCategoria)
        THROW 52409, N'Ya existe una categoría con ese nombre.', 1;

    UPDATE dbo.Categorias SET Nombre = LTRIM(RTRIM(@Nombre)), Descripcion = @Descripcion, Activa = @Activa
    WHERE IDCategoria = @IDCategoria;
    SELECT IDCategoria, Nombre, Descripcion, Activa FROM dbo.Categorias WHERE IDCategoria = @IDCategoria;
END;
GO
