-- Bitácora (Administrador), filtrable por módulo. Solo lectura: la tabla
-- tiene un trigger que impide modificar o eliminar filas.
-- @Orden: recientes (por defecto) o antiguos. El orden usa CASE.
CREATE OR ALTER PROCEDURE dbo.SP_Bitacora_Listar
    @IDUsuario INT,
    @Modulo    NVARCHAR(20) = NULL,
    @Desde     DATE = NULL,
    @Hasta     DATE = NULL,
    @Orden     NVARCHAR(20) = N'recientes',
    @Pagina    INT = 1,
    @Tamano    INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador consulta la bitácora.', 1;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;
    IF @Orden NOT IN (N'recientes', N'antiguos')
        THROW 52400, N'Orden inválido. Use recientes o antiguos.', 1;

    SELECT b.IDBitacora, b.Fecha, b.IDUsuario, u.Nombre AS Usuario, b.Modulo, b.Entidad, b.IDEntidad,
           b.Accion, b.ValorAnterior, b.ValorNuevo, COUNT(*) OVER () AS TotalFilas
    FROM dbo.Bitacora b
    LEFT JOIN dbo.Usuarios u ON u.IDUsuario = b.IDUsuario
    WHERE (@Modulo IS NULL OR b.Modulo = @Modulo)
      AND (@Desde IS NULL OR b.Fecha >= @Desde)
      AND (@Hasta IS NULL OR b.Fecha < DATEADD(DAY, 1, @Hasta))
    ORDER BY
        CASE WHEN @Orden = N'antiguos' THEN b.IDBitacora END ASC,
        b.IDBitacora DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO
