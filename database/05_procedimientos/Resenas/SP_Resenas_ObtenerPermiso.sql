-- Indica si el usuario autenticado puede reseñar el producto. Motivo es NULL si puede;
-- si no, Rol (no es Cliente), Repetida (ya lo reseñó) o SinCompra (sin pedido Entregado).
CREATE OR ALTER PROCEDURE dbo.SP_Resenas_ObtenerPermiso
    @IDUsuario  INT,
    @IDProducto INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Rol NVARCHAR(20) = dbo.FU_Auth_Rol(@IDUsuario);
    IF @Rol IS NULL THROW 52403, N'Usuario no autorizado.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE IDProducto = @IDProducto AND Activo = 1)
        THROW 52404, N'El producto no existe.', 1;

    SELECT CASE
        WHEN @Rol <> N'Cliente' THEN N'Rol'
        WHEN EXISTS (SELECT 1 FROM dbo.Resenas WHERE IDProducto = @IDProducto AND IDUsuario = @IDUsuario) THEN N'Repetida'
        WHEN dbo.FU_Resenas_TieneCompra(@IDUsuario, @IDProducto) = 0 THEN N'SinCompra'
    END AS Motivo;
END;
GO
