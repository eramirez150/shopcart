------------------------------------------------------------
-- Cupones (Administrador)
------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Listar
    @IDUsuario INT,
    @Pagina    INT = 1,
    @Tamano    INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona cupones.', 1;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;

    SELECT IDCupon, Codigo, Tipo, Valor, FechaInicio, FechaFin, MinimoCompra, LimiteTotal,
           LimitePorCliente, Usos, IDCategoria, Activo, COUNT(*) OVER () AS TotalFilas
    FROM dbo.Cupones
    ORDER BY IDCupon
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO
