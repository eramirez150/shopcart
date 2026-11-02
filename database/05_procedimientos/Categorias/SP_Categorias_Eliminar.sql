-- Se elimina solo si no tiene productos; si los tiene, se desactiva.
CREATE OR ALTER PROCEDURE dbo.SP_Categorias_Eliminar
    @IDUsuario   INT,
    @IDCategoria INT
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'catalogo.gestionar') = 0
        THROW 52403, N'No tiene permiso para gestionar el catálogo.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria)
        THROW 52404, N'La categoría no existe.', 1;

    IF EXISTS (SELECT 1 FROM dbo.Productos WHERE IDCategoria = @IDCategoria)
       OR EXISTS (SELECT 1 FROM dbo.Cupones WHERE IDCategoria = @IDCategoria)
    BEGIN
        UPDATE dbo.Categorias SET Activa = 0 WHERE IDCategoria = @IDCategoria;
        SELECT N'Desactivada' AS Resultado;
    END
    ELSE
    BEGIN
        DELETE FROM dbo.Categorias WHERE IDCategoria = @IDCategoria;
        SELECT N'Eliminada' AS Resultado;
    END;
END;
GO
