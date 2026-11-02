-- Quita una imagen de un producto (permiso catalogo.gestionar). Una imagen no tiene ventas ni
-- movimientos, por eso se elimina en vez de desactivarse. Devuelve el producto.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_EliminarImagen
    @IDUsuario        INT,
    @IDProductoImagen INT
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'catalogo.gestionar') = 0
        THROW 52403, N'No tiene permiso para gestionar el catálogo.', 1;

    DECLARE @IDProducto INT = (SELECT IDProducto FROM dbo.ProductoImagenes WHERE IDProductoImagen = @IDProductoImagen);
    IF @IDProducto IS NULL THROW 52404, N'La imagen no existe.', 1;

    DELETE FROM dbo.ProductoImagenes WHERE IDProductoImagen = @IDProductoImagen;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto = @IDProducto, @IncluirInactivos = 1;
END;
GO
