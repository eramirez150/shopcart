-- Reseñas públicas de un producto: primero el resumen (total y promedio) y luego la
-- página pedida, las más recientes primero.
CREATE OR ALTER PROCEDURE dbo.SP_Resenas_Listar
    @IDProducto       INT,
    @IncluirInactivos BIT = 0,
    @Pagina           INT = 1,
    @Tamano           INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;

    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE IDProducto = @IDProducto AND (@IncluirInactivos = 1 OR Activo = 1))
        THROW 52404, N'El producto no existe.', 1;

    SELECT COUNT(*) AS Total, CAST(AVG(Calificacion * 1.0) AS DECIMAL(3,2)) AS Promedio
    FROM dbo.Resenas
    WHERE IDProducto = @IDProducto;

    SELECT IDResena, Autor, Calificacion, Comentario, Fecha
    FROM dbo.FU_Resenas_Publicas()
    WHERE IDProducto = @IDProducto
    ORDER BY Fecha DESC, IDResena DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO
