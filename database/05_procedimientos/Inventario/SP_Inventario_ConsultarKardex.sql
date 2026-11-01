-- Kardex de una variante, más reciente primero.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ConsultarKardex
    @IDVariante INT,
    @Pagina     INT = 1,
    @Tamano     INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;

    SELECT k.IDKardex, k.IDVariante, k.Tipo, k.Cantidad, k.ExistenciaResultante, k.Motivo,
           k.IDUsuario, u.Nombre AS Usuario, k.IDPedido, k.Fecha,
           COUNT(*) OVER () AS TotalFilas
    FROM dbo.Kardex k
    LEFT JOIN dbo.Usuarios u ON u.IDUsuario = k.IDUsuario
    WHERE k.IDVariante = @IDVariante
    ORDER BY k.IDKardex DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO
