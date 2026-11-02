------------------------------------------------------------
-- Reseñas de producto
------------------------------------------------------------
-- Crea la reseña del cliente autenticado. Exige un pedido Entregado con el producto.
-- La repetida la detiene la restricción única, así dos envíos simultáneos también dan 409.
CREATE OR ALTER PROCEDURE dbo.SP_Resenas_Crear
    @IDUsuario    INT,
    @IDProducto   INT,
    @Calificacion INT,
    @Comentario   NVARCHAR(1000)
AS
BEGIN
    SET NOCOUNT ON;

    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Cliente'
        THROW 52403, N'Solo los clientes pueden reseñar productos.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE IDProducto = @IDProducto AND Activo = 1)
        THROW 52404, N'El producto no existe.', 1;
    IF @Calificacion IS NULL OR @Calificacion NOT BETWEEN 1 AND 5
        THROW 52400, N'La calificación debe estar entre 1 y 5.', 1;
    IF ISNULL(LEN(LTRIM(RTRIM(@Comentario))), 0) = 0
        THROW 52400, N'El comentario es obligatorio.', 1;
    IF dbo.FU_Resenas_TieneCompra(@IDUsuario, @IDProducto) = 0
        THROW 52403, N'Solo se puede reseñar un producto comprado y entregado.', 1;

    DECLARE @IDResena INT;
    BEGIN TRY
        INSERT INTO dbo.Resenas (IDProducto, IDUsuario, Calificacion, Comentario)
        VALUES (@IDProducto, @IDUsuario, @Calificacion, LTRIM(RTRIM(@Comentario)));
        SET @IDResena = SCOPE_IDENTITY();
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() IN (2601, 2627)
            THROW 52409, N'Este producto ya tiene una reseña de esta cuenta.', 1;
        THROW;
    END CATCH;

    SELECT IDResena, Autor, Calificacion, Comentario, Fecha
    FROM dbo.FU_Resenas_Publicas() WHERE IDResena = @IDResena;
END;
GO
