-- Inventario: disponibilidad, kardex y rol de un usuario.
--
-- Convención de errores: THROW con número 52000 + código HTTP.
--   52400 datos inválidos, 52401 no autenticado, 52403 sin permiso,
--   52404 no existe, 52409 conflicto con el estado actual.
-- La API traduce ese número al código HTTP (error.number - 52000).

-- Rol de un usuario activo. Devuelve NULL si no existe o está desactivado.
CREATE OR ALTER FUNCTION dbo.FU_Auth_Rol (@IDUsuario INT)
RETURNS NVARCHAR(20)
AS
BEGIN
    RETURN (SELECT Rol FROM dbo.Usuarios WHERE IDUsuario = @IDUsuario AND Activo = 1);
END;
GO

-- Disponible = existencia física - reservas Activa con Expira futura.
-- Una reserva Consumida, Anulada o vencida no cuenta.
CREATE OR ALTER FUNCTION dbo.FU_Inventario_Disponibilidad ()
RETURNS TABLE
AS
RETURN
    SELECT
        v.IDVariante,
        v.Existencia,
        ISNULL(r.Reservado, 0) AS Reservado,
        CASE WHEN v.Existencia - ISNULL(r.Reservado, 0) < 0 THEN 0
             ELSE v.Existencia - ISNULL(r.Reservado, 0) END AS Disponible
    FROM dbo.Variantes v
    OUTER APPLY (
        SELECT SUM(rd.Cantidad) AS Reservado
        FROM dbo.ReservaDetalle rd
        JOIN dbo.Reservas rs ON rs.IDReserva = rd.IDReserva
        WHERE rd.IDVariante = v.IDVariante
          AND rs.Estado = N'Activa'
          AND rs.Expira > SYSUTCDATETIME()
    ) r;
GO

-- Único punto que cambia la existencia: actualiza Variantes y escribe el kardex
-- en la misma transacción, así la existencia siempre es la suma del kardex.
-- @Cantidad lleva signo (positiva entra, negativa sale). Si no hay una
-- transacción abierta, abre una propia.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_RegistrarMovimiento
    @IDVariante INT,
    @Tipo       NVARCHAR(12),
    @Cantidad   INT,
    @Motivo     NVARCHAR(300),
    @IDUsuario  INT = NULL,
    @IDPedido   INT = NULL,
    @IDKardex   INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Tipo NOT IN (N'Entrada', N'Salida', N'Ajuste', N'Devolucion')
        THROW 52400, N'Tipo de movimiento inválido.', 1;
    IF @Cantidad = 0
        THROW 52400, N'La cantidad no puede ser cero.', 1;
    IF @Motivo IS NULL OR LEN(LTRIM(RTRIM(@Motivo))) = 0
        THROW 52400, N'El motivo es obligatorio.', 1;
    IF (@Tipo IN (N'Entrada', N'Devolucion') AND @Cantidad < 0) OR (@Tipo = N'Salida' AND @Cantidad > 0)
        THROW 52400, N'El signo de la cantidad no corresponde al tipo de movimiento.', 1;

    DECLARE @propia BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;
    DECLARE @Existencia INT;

    BEGIN TRY
        IF @propia = 1 BEGIN TRANSACTION;

        EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

        -- El bloqueo evita que dos movimientos lean la misma existencia.
        SELECT @Existencia = Existencia
        FROM dbo.Variantes WITH (UPDLOCK, HOLDLOCK)
        WHERE IDVariante = @IDVariante;

        IF @Existencia IS NULL
            THROW 52404, N'La variante no existe.', 1;
        IF @Existencia + @Cantidad < 0
            THROW 52409, N'La existencia no puede quedar en negativo.', 1;

        SET @Existencia = @Existencia + @Cantidad;

        UPDATE dbo.Variantes SET Existencia = @Existencia WHERE IDVariante = @IDVariante;

        INSERT INTO dbo.Kardex (IDVariante, Tipo, Cantidad, ExistenciaResultante, Motivo, IDUsuario, IDPedido)
        VALUES (@IDVariante, @Tipo, @Cantidad, @Existencia, LTRIM(RTRIM(@Motivo)), @IDUsuario, @IDPedido);
        SET @IDKardex = SCOPE_IDENTITY();

        IF @propia = 1 COMMIT TRANSACTION;

    END TRY
    BEGIN CATCH
        IF @propia = 1 AND @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- Movimiento manual del Operador o del Administrador.
-- Entrada y Salida reciben la cantidad en positivo; Ajuste lleva signo.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_Registrar
    @IDUsuario  INT,
    @IDVariante INT,
    @Tipo       NVARCHAR(12),
    @Cantidad   INT,
    @Motivo     NVARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') NOT IN (N'Operador', N'Administrador')
        THROW 52403, N'No tiene permiso para registrar movimientos de inventario.', 1;
    IF @Tipo NOT IN (N'Entrada', N'Salida', N'Ajuste')
        THROW 52400, N'El tipo debe ser Entrada, Salida o Ajuste.', 1;
    IF @Tipo <> N'Ajuste' AND @Cantidad <= 0
        THROW 52400, N'La cantidad debe ser mayor que cero.', 1;

    DECLARE @Firmada INT = CASE WHEN @Tipo = N'Salida' THEN -@Cantidad ELSE @Cantidad END;

    DECLARE @IDKardex INT;
    EXEC dbo.SP_Inventario_RegistrarMovimiento
        @IDVariante = @IDVariante, @Tipo = @Tipo, @Cantidad = @Firmada,
        @Motivo = @Motivo, @IDUsuario = @IDUsuario, @IDKardex = @IDKardex OUTPUT;

    SELECT IDKardex, IDVariante, Tipo, Cantidad, ExistenciaResultante, Motivo, Fecha
    FROM dbo.Kardex WHERE IDKardex = @IDKardex;
END;
GO

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

-- Existencia, reservado y disponible por variante. @Umbral filtra las que
-- tienen disponible igual o menor al umbral.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarExistencias
    @Umbral INT = NULL,
    @Pagina INT = 1,
    @Tamano INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;

    SELECT v.IDVariante, v.SKU, p.Nombre AS Producto, v.Atributos,
           d.Existencia, d.Reservado, d.Disponible,
           COUNT(*) OVER () AS TotalFilas
    FROM dbo.FU_Inventario_Disponibilidad() d
    JOIN dbo.Variantes v ON v.IDVariante = d.IDVariante
    JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
    WHERE v.Activa = 1 AND (@Umbral IS NULL OR d.Disponible <= @Umbral)
    ORDER BY d.Disponible, v.IDVariante
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO
