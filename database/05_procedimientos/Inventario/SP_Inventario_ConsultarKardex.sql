-- Kardex de una variante. @Orden: recientes (por defecto) o antiguos, por orden de registro.
-- El orden usa CASE. Exige el permiso inventario.ver.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ConsultarKardex
    @IDUsuario  INT,
    @IDVariante INT,
    @Orden      NVARCHAR(20) = N'recientes',
    @Pagina     INT = 1,
    @Tamano     INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'inventario.ver') = 0
        THROW 52403, N'No tiene permiso para consultar el inventario.', 1;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;
    IF @Orden NOT IN (N'recientes', N'antiguos')
        THROW 52400, N'Orden inválido. Use recientes o antiguos.', 1;

    SELECT k.IDKardex, k.IDVariante, k.Tipo, k.Cantidad, k.ExistenciaResultante, k.Motivo,
           k.IDUsuario, u.Nombre AS Usuario, k.IDPedido, k.Fecha,
           COUNT(*) OVER () AS TotalFilas
    FROM dbo.Kardex k
    LEFT JOIN dbo.Usuarios u ON u.IDUsuario = k.IDUsuario
    WHERE k.IDVariante = @IDVariante
    ORDER BY
        CASE WHEN @Orden = N'antiguos' THEN k.IDKardex END ASC,
        k.IDKardex DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO
