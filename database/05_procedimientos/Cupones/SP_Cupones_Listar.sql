------------------------------------------------------------
-- Cupones (permiso cupones.gestionar)
------------------------------------------------------------
-- @Orden: id (por defecto), codigo, vence (fecha final más próxima primero) o usos
-- (más usados primero). El orden usa CASE.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Listar
    @IDUsuario INT,
    @Orden     NVARCHAR(20) = N'id',
    @Pagina    INT = 1,
    @Tamano    INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'cupones.gestionar') = 0
        THROW 52403, N'No tiene permiso para gestionar cupones.', 1;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;
    IF @Orden NOT IN (N'id', N'codigo', N'vence', N'usos')
        THROW 52400, N'Orden inválido. Use id, codigo, vence o usos.', 1;

    SELECT IDCupon, Codigo, Tipo, Valor, FechaInicio, FechaFin, MinimoCompra, LimiteTotal,
           LimitePorCliente, Usos, IDCategoria, Activo, COUNT(*) OVER () AS TotalFilas
    FROM dbo.Cupones
    ORDER BY
        CASE WHEN @Orden = N'codigo' THEN Codigo END ASC,
        CASE WHEN @Orden = N'vence'  THEN FechaFin END ASC,
        CASE WHEN @Orden = N'usos'   THEN Usos END DESC,
        IDCupon
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO
