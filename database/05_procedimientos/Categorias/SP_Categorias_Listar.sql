------------------------------------------------------------
-- Categorías
------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.SP_Categorias_Listar
    @IncluirInactivas BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT IDCategoria, Nombre, Descripcion, Activa
    FROM dbo.Categorias
    WHERE @IncluirInactivas = 1 OR Activa = 1
    ORDER BY Nombre;
END;
GO
