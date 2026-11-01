------------------------------------------------------------
-- Bitácora
------------------------------------------------------------
-- Los SP que modifican datos guardan el usuario con
-- sp_set_session_context N'IDUsuario'; los triggers lo leen de ahí.
CREATE TABLE dbo.Bitacora (
    IDBitacora     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Bitacora PRIMARY KEY,
    Fecha          DATETIME2(0)  NOT NULL CONSTRAINT DF_Bitacora_Fecha DEFAULT (SYSUTCDATETIME()),
    IDUsuario      INT           NULL CONSTRAINT FK_Bitacora_Usuarios REFERENCES dbo.Usuarios (IDUsuario),
    Modulo         NVARCHAR(20)  NOT NULL CONSTRAINT CK_Bitacora_Modulo CHECK (Modulo IN (N'Catalogo', N'Inventario', N'Cupones', N'Pedidos')),
    Entidad        NVARCHAR(30)  NOT NULL,
    IDEntidad      INT           NOT NULL,
    Accion         NVARCHAR(20)  NOT NULL CONSTRAINT CK_Bitacora_Accion CHECK (Accion IN (N'Creacion', N'Modificacion', N'Desactivacion', N'Eliminacion')),
    ValorAnterior  NVARCHAR(MAX) NULL,
    ValorNuevo     NVARCHAR(MAX) NULL
);
CREATE INDEX IX_Bitacora_Modulo_Fecha ON dbo.Bitacora (Modulo, Fecha DESC);
GO

-- La bitácora no se puede modificar ni eliminar.
CREATE TRIGGER dbo.TR_Bitacora_Inmutable ON dbo.Bitacora
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 51403, N'La bitácora no se puede modificar ni eliminar.', 1;
END;
GO

-- Triggers que alimentan la bitácora. Accion se deduce así:
-- sin fila anterior = Creacion; sin fila nueva = Eliminacion;
-- Activo/Activa pasa de 1 a 0 = Desactivacion; cualquier otro cambio = Modificacion.
CREATE TRIGGER dbo.TR_Productos_Bitacora ON dbo.Productos
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
    SELECT
        CAST(SESSION_CONTEXT(N'IDUsuario') AS INT),
        N'Catalogo', N'Producto', COALESCE(i.IDProducto, d.IDProducto),
        CASE WHEN d.IDProducto IS NULL THEN N'Creacion'
             WHEN i.IDProducto IS NULL THEN N'Eliminacion'
             WHEN d.Activo = 1 AND i.Activo = 0 THEN N'Desactivacion'
             ELSE N'Modificacion' END,
        (SELECT d.IDCategoria, d.Nombre, d.Descripcion, d.Activo WHERE d.IDProducto IS NOT NULL FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
        (SELECT i.IDCategoria, i.Nombre, i.Descripcion, i.Activo WHERE i.IDProducto IS NOT NULL FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    FULL JOIN deleted d ON d.IDProducto = i.IDProducto;
END;
GO

-- Cubre cambios de precio, existencia, SKU, atributos y desactivación de variantes.
CREATE TRIGGER dbo.TR_Variantes_Bitacora ON dbo.Variantes
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
    SELECT
        CAST(SESSION_CONTEXT(N'IDUsuario') AS INT),
        CASE WHEN d.IDVariante IS NOT NULL AND i.IDVariante IS NOT NULL
                  AND d.Existencia <> i.Existencia AND d.Precio = i.Precio
             THEN N'Inventario' ELSE N'Catalogo' END,
        N'Variante', COALESCE(i.IDVariante, d.IDVariante),
        CASE WHEN d.IDVariante IS NULL THEN N'Creacion'
             WHEN i.IDVariante IS NULL THEN N'Eliminacion'
             WHEN d.Activa = 1 AND i.Activa = 0 THEN N'Desactivacion'
             ELSE N'Modificacion' END,
        (SELECT d.IDProducto, d.SKU, d.Atributos, d.Precio, d.Existencia, d.Activa WHERE d.IDVariante IS NOT NULL FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
        (SELECT i.IDProducto, i.SKU, i.Atributos, i.Precio, i.Existencia, i.Activa WHERE i.IDVariante IS NOT NULL FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    FULL JOIN deleted d ON d.IDVariante = i.IDVariante;
END;
GO

-- Usos no se registra aquí: cambia con cada pedido y ya queda en CuponUsos.
CREATE TRIGGER dbo.TR_Cupones_Bitacora ON dbo.Cupones
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
    SELECT
        CAST(SESSION_CONTEXT(N'IDUsuario') AS INT),
        N'Cupones', N'Cupon', COALESCE(i.IDCupon, d.IDCupon),
        CASE WHEN d.IDCupon IS NULL THEN N'Creacion'
             WHEN i.IDCupon IS NULL THEN N'Eliminacion'
             WHEN d.Activo = 1 AND i.Activo = 0 THEN N'Desactivacion'
             ELSE N'Modificacion' END,
        (SELECT d.Codigo, d.Tipo, d.Valor, d.FechaInicio, d.FechaFin, d.MinimoCompra, d.LimiteTotal, d.LimitePorCliente, d.IDCategoria, d.Activo WHERE d.IDCupon IS NOT NULL FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
        (SELECT i.Codigo, i.Tipo, i.Valor, i.FechaInicio, i.FechaFin, i.MinimoCompra, i.LimiteTotal, i.LimitePorCliente, i.IDCategoria, i.Activo WHERE i.IDCupon IS NOT NULL FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    FULL JOIN deleted d ON d.IDCupon = i.IDCupon
    WHERE d.IDCupon IS NULL OR i.IDCupon IS NULL
       OR EXISTS (SELECT i.Codigo, i.Tipo, i.Valor, i.FechaInicio, i.FechaFin, i.MinimoCompra, i.LimiteTotal, i.LimitePorCliente, i.IDCategoria, i.Activo
                  EXCEPT
                  SELECT d.Codigo, d.Tipo, d.Valor, d.FechaInicio, d.FechaFin, d.MinimoCompra, d.LimiteTotal, d.LimitePorCliente, d.IDCategoria, d.Activo);
END;
GO

-- Solo registra los cambios de estado de los pedidos.
CREATE TRIGGER dbo.TR_Pedidos_Bitacora ON dbo.Pedidos
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
    SELECT
        CAST(SESSION_CONTEXT(N'IDUsuario') AS INT),
        N'Pedidos', N'Pedido', i.IDPedido, N'Modificacion',
        (SELECT d.Estado FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
        (SELECT i.Estado FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    JOIN deleted d ON d.IDPedido = i.IDPedido
    WHERE d.Estado <> i.Estado;
END;
GO
