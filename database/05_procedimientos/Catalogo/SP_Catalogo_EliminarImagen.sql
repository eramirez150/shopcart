-- Quita una imagen de un producto (Administrador). Una imagen no tiene ventas ni
-- movimientos, por eso se elimina en vez de desactivarse. Devuelve el producto.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_EliminarImagen
    @IDUsuario        INT,
    @IDProductoImagen INT
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona el catálogo.', 1;

    DECLARE @IDProducto INT = (SELECT IDProducto FROM dbo.ProductoImagenes WHERE IDProductoImagen = @IDProductoImagen);
    IF @IDProducto IS NULL THROW 52404, N'La imagen no existe.', 1;

    DELETE FROM dbo.ProductoImagenes WHERE IDProductoImagen = @IDProductoImagen;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto = @IDProducto, @IncluirInactivos = 1;
END;
GO
