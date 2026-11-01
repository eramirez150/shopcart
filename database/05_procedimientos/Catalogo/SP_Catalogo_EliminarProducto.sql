-- Un producto con ventas, reservas, movimientos o en carritos se desactiva
-- (junto con sus variantes); si nunca se usó, se elimina con sus variantes e imágenes.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_EliminarProducto
    @IDUsuario  INT,
    @IDProducto INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona el catálogo.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE IDProducto = @IDProducto)
        THROW 52404, N'El producto no existe.', 1;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

    DECLARE @EnUso BIT = CASE WHEN EXISTS (
        SELECT 1 FROM dbo.Variantes v
        WHERE v.IDProducto = @IDProducto
          AND (EXISTS (SELECT 1 FROM dbo.PedidoDetalle WHERE IDVariante = v.IDVariante)
            OR EXISTS (SELECT 1 FROM dbo.ReservaDetalle WHERE IDVariante = v.IDVariante)
            OR EXISTS (SELECT 1 FROM dbo.CarritoDetalle WHERE IDVariante = v.IDVariante)
            OR EXISTS (SELECT 1 FROM dbo.Kardex WHERE IDVariante = v.IDVariante))
    ) THEN 1 ELSE 0 END;

    BEGIN TRANSACTION;
    IF @EnUso = 1
    BEGIN
        UPDATE dbo.Variantes SET Activa = 0 WHERE IDProducto = @IDProducto AND Activa = 1;
        UPDATE dbo.Productos SET Activo = 0 WHERE IDProducto = @IDProducto AND Activo = 1;
        SELECT N'Desactivado' AS Resultado;
    END
    ELSE
    BEGIN
        DELETE FROM dbo.ProductoImagenes WHERE IDProducto = @IDProducto;
        DELETE FROM dbo.Variantes WHERE IDProducto = @IDProducto;
        DELETE FROM dbo.Productos WHERE IDProducto = @IDProducto;
        SELECT N'Eliminado' AS Resultado;
    END;
    COMMIT TRANSACTION;
END;
GO
