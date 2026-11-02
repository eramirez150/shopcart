CREATE OR ALTER PROCEDURE dbo.SP_Categorias_Crear
    @IDUsuario   INT,
    @Nombre      NVARCHAR(80),
    @Descripcion NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'catalogo.gestionar') = 0
        THROW 52403, N'No tiene permiso para gestionar el catálogo.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = LTRIM(RTRIM(@Nombre)))
        THROW 52409, N'Ya existe una categoría con ese nombre.', 1;

    INSERT INTO dbo.Categorias (Nombre, Descripcion) VALUES (LTRIM(RTRIM(@Nombre)), @Descripcion);
    SELECT IDCategoria, Nombre, Descripcion, Activa FROM dbo.Categorias WHERE IDCategoria = SCOPE_IDENTITY();
END;
GO
