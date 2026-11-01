-- Catálogo: categorías, productos y variantes.
-- Las escrituras exigen rol Administrador y guardan el usuario para la bitácora.
-- Nada con ventas o movimientos se elimina: se desactiva.

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

CREATE OR ALTER PROCEDURE dbo.SP_Categorias_Crear
    @IDUsuario   INT,
    @Nombre      NVARCHAR(80),
    @Descripcion NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona el catálogo.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = LTRIM(RTRIM(@Nombre)))
        THROW 52409, N'Ya existe una categoría con ese nombre.', 1;

    INSERT INTO dbo.Categorias (Nombre, Descripcion) VALUES (LTRIM(RTRIM(@Nombre)), @Descripcion);
    SELECT IDCategoria, Nombre, Descripcion, Activa FROM dbo.Categorias WHERE IDCategoria = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Categorias_Actualizar
    @IDUsuario   INT,
    @IDCategoria INT,
    @Nombre      NVARCHAR(80),
    @Descripcion NVARCHAR(300) = NULL,
    @Activa      BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona el catálogo.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria)
        THROW 52404, N'La categoría no existe.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = LTRIM(RTRIM(@Nombre)) AND IDCategoria <> @IDCategoria)
        THROW 52409, N'Ya existe una categoría con ese nombre.', 1;

    UPDATE dbo.Categorias SET Nombre = LTRIM(RTRIM(@Nombre)), Descripcion = @Descripcion, Activa = @Activa
    WHERE IDCategoria = @IDCategoria;
    SELECT IDCategoria, Nombre, Descripcion, Activa FROM dbo.Categorias WHERE IDCategoria = @IDCategoria;
END;
GO

-- Se elimina solo si no tiene productos; si los tiene, se desactiva.
CREATE OR ALTER PROCEDURE dbo.SP_Categorias_Eliminar
    @IDUsuario   INT,
    @IDCategoria INT
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona el catálogo.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria)
        THROW 52404, N'La categoría no existe.', 1;

    IF EXISTS (SELECT 1 FROM dbo.Productos WHERE IDCategoria = @IDCategoria)
       OR EXISTS (SELECT 1 FROM dbo.Cupones WHERE IDCategoria = @IDCategoria)
    BEGIN
        UPDATE dbo.Categorias SET Activa = 0 WHERE IDCategoria = @IDCategoria;
        SELECT N'Desactivada' AS Resultado;
    END
    ELSE
    BEGIN
        DELETE FROM dbo.Categorias WHERE IDCategoria = @IDCategoria;
        SELECT N'Eliminada' AS Resultado;
    END;
END;
GO

------------------------------------------------------------
-- Productos y variantes
------------------------------------------------------------
-- Búsqueda con filtros, orden y paginación en el servidor. El orden usa CASE
-- sobre un parámetro tipado: no hay SQL dinámico.
-- @Orden: nombre (por defecto), precio_asc, precio_desc, recientes.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_BuscarProductos
    @Texto            NVARCHAR(100) = NULL,
    @IDCategoria      INT = NULL,
    @PrecioMin        DECIMAL(12,2) = NULL,
    @PrecioMax        DECIMAL(12,2) = NULL,
    @SoloDisponibles  BIT = 0,
    @Orden            NVARCHAR(20) = N'nombre',
    @Pagina           INT = 1,
    @Tamano           INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Tamano < 1 OR @Tamano > 100 SET @Tamano = 20;
    IF @Orden NOT IN (N'nombre', N'precio_asc', N'precio_desc', N'recientes')
        THROW 52400, N'Orden inválido. Use nombre, precio_asc, precio_desc o recientes.', 1;

    WITH Resumen AS (
        SELECT p.IDProducto, p.Nombre, p.Descripcion, p.IDCategoria, c.Nombre AS Categoria, p.FechaCreacion,
               MIN(v.Precio) AS PrecioDesde, MAX(v.Precio) AS PrecioHasta,
               SUM(d.Disponible) AS Disponible, COUNT(*) AS Variantes
        FROM dbo.Productos p
        JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
        JOIN dbo.Variantes v ON v.IDProducto = p.IDProducto AND v.Activa = 1
        JOIN dbo.FU_Inventario_Disponibilidad() d ON d.IDVariante = v.IDVariante
        WHERE p.Activo = 1 AND c.Activa = 1
          AND (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
          AND (@Texto IS NULL OR CHARINDEX(@Texto, p.Nombre) > 0 OR CHARINDEX(@Texto, ISNULL(p.Descripcion, N'')) > 0)
        GROUP BY p.IDProducto, p.Nombre, p.Descripcion, p.IDCategoria, c.Nombre, p.FechaCreacion
    )
    SELECT IDProducto, Nombre, Descripcion, IDCategoria, Categoria, PrecioDesde, PrecioHasta,
           Disponible, Variantes, COUNT(*) OVER () AS TotalFilas
    FROM Resumen
    WHERE (@PrecioMin IS NULL OR PrecioHasta >= @PrecioMin)
      AND (@PrecioMax IS NULL OR PrecioDesde <= @PrecioMax)
      AND (@SoloDisponibles = 0 OR Disponible > 0)
    ORDER BY
        CASE WHEN @Orden = N'precio_asc'  THEN PrecioDesde END ASC,
        CASE WHEN @Orden = N'precio_desc' THEN PrecioDesde END DESC,
        CASE WHEN @Orden = N'recientes'   THEN FechaCreacion END DESC,
        Nombre, IDProducto
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END;
GO

-- Producto con sus variantes. Los clientes solo ven lo activo.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ObtenerProducto
    @IDProducto     INT,
    @IncluirInactivos BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE IDProducto = @IDProducto AND (@IncluirInactivos = 1 OR Activo = 1))
        THROW 52404, N'El producto no existe.', 1;

    SELECT p.IDProducto, p.Nombre, p.Descripcion, p.IDCategoria, c.Nombre AS Categoria, p.Activo, p.FechaCreacion
    FROM dbo.Productos p JOIN dbo.Categorias c ON c.IDCategoria = p.IDCategoria
    WHERE p.IDProducto = @IDProducto;

    SELECT v.IDVariante, v.SKU, v.Atributos, v.Precio, v.Activa, d.Existencia, d.Reservado, d.Disponible
    FROM dbo.Variantes v
    JOIN dbo.FU_Inventario_Disponibilidad() d ON d.IDVariante = v.IDVariante
    WHERE v.IDProducto = @IDProducto AND (@IncluirInactivos = 1 OR v.Activa = 1)
    ORDER BY v.IDVariante;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearProducto
    @IDUsuario   INT,
    @IDCategoria INT,
    @Nombre      NVARCHAR(150),
    @Descripcion NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona el catálogo.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria AND Activa = 1)
        THROW 52404, N'La categoría no existe o está desactivada.', 1;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;
    INSERT INTO dbo.Productos (IDCategoria, Nombre, Descripcion) VALUES (@IDCategoria, LTRIM(RTRIM(@Nombre)), @Descripcion);

    DECLARE @IDProducto INT = SCOPE_IDENTITY();
    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto = @IDProducto, @IncluirInactivos = 1;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarProducto
    @IDUsuario   INT,
    @IDProducto  INT,
    @IDCategoria INT,
    @Nombre      NVARCHAR(150),
    @Descripcion NVARCHAR(1000) = NULL,
    @Activo      BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona el catálogo.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE IDProducto = @IDProducto)
        THROW 52404, N'El producto no existe.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria)
        THROW 52404, N'La categoría no existe.', 1;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;
    UPDATE dbo.Productos
    SET IDCategoria = @IDCategoria, Nombre = LTRIM(RTRIM(@Nombre)), Descripcion = @Descripcion, Activo = @Activo
    WHERE IDProducto = @IDProducto;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto = @IDProducto, @IncluirInactivos = 1;
END;
GO

-- Un producto con ventas, reservas, movimientos o en carritos se desactiva
-- (junto con sus variantes); si nunca se usó, se elimina.
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
        DELETE FROM dbo.Variantes WHERE IDProducto = @IDProducto;
        DELETE FROM dbo.Productos WHERE IDProducto = @IDProducto;
        SELECT N'Eliminado' AS Resultado;
    END;
    COMMIT TRANSACTION;
END;
GO

-- La existencia inicial entra por el kardex, como cualquier otro movimiento.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearVariante
    @IDUsuario         INT,
    @IDProducto        INT,
    @SKU               NVARCHAR(40),
    @Atributos         NVARCHAR(400) = N'{}',
    @Precio            DECIMAL(12,2),
    @ExistenciaInicial INT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona el catálogo.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE IDProducto = @IDProducto)
        THROW 52404, N'El producto no existe.', 1;
    IF @Precio < 0 THROW 52400, N'El precio no puede ser negativo.', 1;
    IF @ExistenciaInicial < 0 THROW 52400, N'La existencia inicial no puede ser negativa.', 1;
    IF ISJSON(@Atributos) <> 1 THROW 52400, N'Los atributos deben ser un objeto JSON.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Variantes WHERE SKU = LTRIM(RTRIM(@SKU)))
        THROW 52409, N'El SKU ya existe.', 1;

    DECLARE @IDVariante INT;
    BEGIN TRANSACTION;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;
    INSERT INTO dbo.Variantes (IDProducto, SKU, Atributos, Precio) VALUES (@IDProducto, LTRIM(RTRIM(@SKU)), @Atributos, @Precio);
    SET @IDVariante = SCOPE_IDENTITY();
    IF @ExistenciaInicial > 0
        EXEC dbo.SP_Inventario_RegistrarMovimiento @IDVariante = @IDVariante, @Tipo = N'Entrada',
             @Cantidad = @ExistenciaInicial, @Motivo = N'Inventario inicial', @IDUsuario = @IDUsuario;
    COMMIT TRANSACTION;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto = @IDProducto, @IncluirInactivos = 1;
END;
GO

-- Cambia SKU, atributos, precio o estado. La existencia solo cambia por el kardex.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarVariante
    @IDUsuario  INT,
    @IDVariante INT,
    @SKU        NVARCHAR(40),
    @Atributos  NVARCHAR(400) = N'{}',
    @Precio     DECIMAL(12,2),
    @Activa     BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona el catálogo.', 1;
    DECLARE @IDProducto INT = (SELECT IDProducto FROM dbo.Variantes WHERE IDVariante = @IDVariante);
    IF @IDProducto IS NULL THROW 52404, N'La variante no existe.', 1;
    IF @Precio < 0 THROW 52400, N'El precio no puede ser negativo.', 1;
    IF ISJSON(@Atributos) <> 1 THROW 52400, N'Los atributos deben ser un objeto JSON.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Variantes WHERE SKU = LTRIM(RTRIM(@SKU)) AND IDVariante <> @IDVariante)
        THROW 52409, N'El SKU ya existe.', 1;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;
    UPDATE dbo.Variantes SET SKU = LTRIM(RTRIM(@SKU)), Atributos = @Atributos, Precio = @Precio, Activa = @Activa
    WHERE IDVariante = @IDVariante;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto = @IDProducto, @IncluirInactivos = 1;
END;
GO
