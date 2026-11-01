-- Tablas de ShopCart con llaves, restricciones e índices.
-- Las fechas se guardan en UTC. Los montos usan DECIMAL(12,2) y las cantidades INT.

------------------------------------------------------------
-- Autenticación y usuarios
------------------------------------------------------------
CREATE TABLE dbo.Usuarios (
    IDUsuario       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Usuarios PRIMARY KEY,
    Correo          NVARCHAR(150) NOT NULL CONSTRAINT UQ_Usuarios_Correo UNIQUE,
    ClaveHash       NVARCHAR(100) NOT NULL,
    Nombre          NVARCHAR(100) NOT NULL,
    Rol             NVARCHAR(20)  NOT NULL CONSTRAINT CK_Usuarios_Rol CHECK (Rol IN (N'Cliente', N'Operador', N'Administrador')),
    Activo          BIT           NOT NULL CONSTRAINT DF_Usuarios_Activo DEFAULT (1),
    FechaCreacion   DATETIME2(0)  NOT NULL CONSTRAINT DF_Usuarios_FechaCreacion DEFAULT (SYSUTCDATETIME())
);
GO

-- Solo se guarda el SHA-256 del refresh token, nunca el token.
CREATE TABLE dbo.RefreshTokens (
    IDRefreshToken  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RefreshTokens PRIMARY KEY,
    IDUsuario       INT          NOT NULL CONSTRAINT FK_RefreshTokens_Usuarios REFERENCES dbo.Usuarios (IDUsuario),
    TokenHash       CHAR(64)     NOT NULL CONSTRAINT UQ_RefreshTokens_TokenHash UNIQUE,
    Expira          DATETIME2(0) NOT NULL,
    FechaCreacion   DATETIME2(0) NOT NULL CONSTRAINT DF_RefreshTokens_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaRevocado   DATETIME2(0) NULL
);
CREATE INDEX IX_RefreshTokens_IDUsuario ON dbo.RefreshTokens (IDUsuario) WHERE FechaRevocado IS NULL;
GO

------------------------------------------------------------
-- Catálogo
------------------------------------------------------------
CREATE TABLE dbo.Categorias (
    IDCategoria     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Categorias PRIMARY KEY,
    Nombre          NVARCHAR(80)  NOT NULL CONSTRAINT UQ_Categorias_Nombre UNIQUE,
    Descripcion     NVARCHAR(300) NULL,
    Activa          BIT           NOT NULL CONSTRAINT DF_Categorias_Activa DEFAULT (1)
);
GO

CREATE TABLE dbo.Productos (
    IDProducto      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Productos PRIMARY KEY,
    IDCategoria     INT            NOT NULL CONSTRAINT FK_Productos_Categorias REFERENCES dbo.Categorias (IDCategoria),
    Nombre          NVARCHAR(150)  NOT NULL,
    Descripcion     NVARCHAR(1000) NULL,
    Activo          BIT            NOT NULL CONSTRAINT DF_Productos_Activo DEFAULT (1),
    FechaCreacion   DATETIME2(0)   NOT NULL CONSTRAINT DF_Productos_FechaCreacion DEFAULT (SYSUTCDATETIME())
);
CREATE INDEX IX_Productos_IDCategoria ON dbo.Productos (IDCategoria) INCLUDE (Nombre, Activo);
CREATE INDEX IX_Productos_Nombre ON dbo.Productos (Nombre);
GO

-- Atributos guarda un objeto JSON, por ejemplo {"Talla":"M","Color":"Azul"}.
-- Existencia es la existencia física y siempre coincide con la suma del kardex.
CREATE TABLE dbo.Variantes (
    IDVariante      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Variantes PRIMARY KEY,
    IDProducto      INT           NOT NULL CONSTRAINT FK_Variantes_Productos REFERENCES dbo.Productos (IDProducto),
    SKU             NVARCHAR(40)  NOT NULL CONSTRAINT UQ_Variantes_SKU UNIQUE,
    Atributos       NVARCHAR(400) NOT NULL CONSTRAINT DF_Variantes_Atributos DEFAULT (N'{}'),
    Precio          DECIMAL(12,2) NOT NULL CONSTRAINT CK_Variantes_Precio CHECK (Precio >= 0),
    Existencia      INT           NOT NULL CONSTRAINT DF_Variantes_Existencia DEFAULT (0)
                                           CONSTRAINT CK_Variantes_Existencia CHECK (Existencia >= 0),
    Activa          BIT           NOT NULL CONSTRAINT DF_Variantes_Activa DEFAULT (1),
    CONSTRAINT CK_Variantes_Atributos CHECK (ISJSON(Atributos) = 1)
);
CREATE INDEX IX_Variantes_IDProducto ON dbo.Variantes (IDProducto) INCLUDE (Precio, Existencia, Activa);
GO

------------------------------------------------------------
-- Cupones
------------------------------------------------------------
-- Si IDCategoria es NULL el cupón aplica a todo el carrito;
-- si no, solo a las líneas de esa categoría.
CREATE TABLE dbo.Cupones (
    IDCupon          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Cupones PRIMARY KEY,
    Codigo           NVARCHAR(30)  NOT NULL CONSTRAINT UQ_Cupones_Codigo UNIQUE,
    Tipo             NVARCHAR(10)  NOT NULL CONSTRAINT CK_Cupones_Tipo CHECK (Tipo IN (N'Porcentaje', N'Monto')),
    Valor            DECIMAL(12,2) NOT NULL,
    FechaInicio      DATETIME2(0)  NOT NULL,
    FechaFin         DATETIME2(0)  NOT NULL,
    MinimoCompra     DECIMAL(12,2) NOT NULL CONSTRAINT DF_Cupones_MinimoCompra DEFAULT (0)
                                            CONSTRAINT CK_Cupones_MinimoCompra CHECK (MinimoCompra >= 0),
    LimiteTotal      INT           NULL CONSTRAINT CK_Cupones_LimiteTotal CHECK (LimiteTotal > 0),
    LimitePorCliente INT           NULL CONSTRAINT CK_Cupones_LimitePorCliente CHECK (LimitePorCliente > 0),
    Usos             INT           NOT NULL CONSTRAINT DF_Cupones_Usos DEFAULT (0),
    IDCategoria      INT           NULL CONSTRAINT FK_Cupones_Categorias REFERENCES dbo.Categorias (IDCategoria),
    Activo           BIT           NOT NULL CONSTRAINT DF_Cupones_Activo DEFAULT (1),
    CONSTRAINT CK_Cupones_Valor CHECK (Valor > 0 AND (Tipo = N'Monto' OR Valor <= 100)),
    CONSTRAINT CK_Cupones_Fechas CHECK (FechaFin > FechaInicio),
    CONSTRAINT CK_Cupones_Usos CHECK (Usos >= 0 AND (LimiteTotal IS NULL OR Usos <= LimiteTotal))
);
GO

------------------------------------------------------------
-- Carrito
------------------------------------------------------------
-- Un carrito pertenece a un usuario o a un invitado identificado por TokenInvitado.
CREATE TABLE dbo.Carritos (
    IDCarrito          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Carritos PRIMARY KEY,
    IDUsuario          INT              NULL CONSTRAINT FK_Carritos_Usuarios REFERENCES dbo.Usuarios (IDUsuario),
    TokenInvitado      UNIQUEIDENTIFIER NULL,
    Estado             NVARCHAR(12)     NOT NULL CONSTRAINT DF_Carritos_Estado DEFAULT (N'Abierto')
                                        CONSTRAINT CK_Carritos_Estado CHECK (Estado IN (N'Abierto', N'Convertido', N'Fusionado')),
    IDCupon            INT              NULL CONSTRAINT FK_Carritos_Cupones REFERENCES dbo.Cupones (IDCupon),
    FechaCreacion      DATETIME2(0)     NOT NULL CONSTRAINT DF_Carritos_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion DATETIME2(0)     NOT NULL CONSTRAINT DF_Carritos_FechaActualizacion DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Carritos_Duenio CHECK (IDUsuario IS NOT NULL OR TokenInvitado IS NOT NULL)
);
-- Un solo carrito abierto por usuario y por token de invitado.
CREATE UNIQUE INDEX UX_Carritos_UsuarioAbierto ON dbo.Carritos (IDUsuario) WHERE Estado = N'Abierto' AND IDUsuario IS NOT NULL;
CREATE UNIQUE INDEX UX_Carritos_TokenInvitado ON dbo.Carritos (TokenInvitado) WHERE TokenInvitado IS NOT NULL;
CREATE INDEX IX_Carritos_Estado_Fecha ON dbo.Carritos (Estado, FechaActualizacion);
GO

CREATE TABLE dbo.CarritoDetalle (
    IDCarritoDetalle INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CarritoDetalle PRIMARY KEY,
    IDCarrito        INT NOT NULL CONSTRAINT FK_CarritoDetalle_Carritos REFERENCES dbo.Carritos (IDCarrito),
    IDVariante       INT NOT NULL CONSTRAINT FK_CarritoDetalle_Variantes REFERENCES dbo.Variantes (IDVariante),
    Cantidad         INT NOT NULL CONSTRAINT CK_CarritoDetalle_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT UQ_CarritoDetalle_Carrito_Variante UNIQUE (IDCarrito, IDVariante)
);
CREATE INDEX IX_CarritoDetalle_IDVariante ON dbo.CarritoDetalle (IDVariante);
GO

------------------------------------------------------------
-- Checkout: reservas de 15 minutos
------------------------------------------------------------
-- Estado: Activa, Consumida (se convirtió en pedido) o Anulada.
-- Una reserva Activa con Expira pasada está vencida y ya no resta del disponible.
CREATE TABLE dbo.Reservas (
    IDReserva        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Reservas PRIMARY KEY,
    IDUsuario        INT           NOT NULL CONSTRAINT FK_Reservas_Usuarios REFERENCES dbo.Usuarios (IDUsuario),
    IDCarrito        INT           NOT NULL CONSTRAINT FK_Reservas_Carritos REFERENCES dbo.Carritos (IDCarrito),
    Estado           NVARCHAR(10)  NOT NULL CONSTRAINT DF_Reservas_Estado DEFAULT (N'Activa')
                                   CONSTRAINT CK_Reservas_Estado CHECK (Estado IN (N'Activa', N'Consumida', N'Anulada')),
    Expira           DATETIME2(0)  NOT NULL,
    IDCupon          INT           NULL CONSTRAINT FK_Reservas_Cupones REFERENCES dbo.Cupones (IDCupon),
    Subtotal         DECIMAL(12,2) NOT NULL CONSTRAINT CK_Reservas_Subtotal CHECK (Subtotal >= 0),
    Descuento        DECIMAL(12,2) NOT NULL CONSTRAINT CK_Reservas_Descuento CHECK (Descuento >= 0),
    Total            DECIMAL(12,2) NOT NULL CONSTRAINT CK_Reservas_Total CHECK (Total >= 0),
    Direccion        NVARCHAR(300) NOT NULL,
    Ciudad           NVARCHAR(100) NOT NULL,
    Telefono         NVARCHAR(20)  NOT NULL,
    FechaCreacion    DATETIME2(0)  NOT NULL CONSTRAINT DF_Reservas_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Reservas_Total_Calculo CHECK (Total = Subtotal - Descuento)
);
-- Solo una reserva activa por carrito.
CREATE UNIQUE INDEX UX_Reservas_CarritoActiva ON dbo.Reservas (IDCarrito) WHERE Estado = N'Activa';
CREATE INDEX IX_Reservas_IDUsuario ON dbo.Reservas (IDUsuario);
GO

-- Precio y descuento quedan congelados al reservar.
CREATE TABLE dbo.ReservaDetalle (
    IDReservaDetalle INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ReservaDetalle PRIMARY KEY,
    IDReserva        INT           NOT NULL CONSTRAINT FK_ReservaDetalle_Reservas REFERENCES dbo.Reservas (IDReserva),
    IDVariante       INT           NOT NULL CONSTRAINT FK_ReservaDetalle_Variantes REFERENCES dbo.Variantes (IDVariante),
    Cantidad         INT           NOT NULL CONSTRAINT CK_ReservaDetalle_Cantidad CHECK (Cantidad > 0),
    PrecioUnitario   DECIMAL(12,2) NOT NULL CONSTRAINT CK_ReservaDetalle_Precio CHECK (PrecioUnitario >= 0),
    Descuento        DECIMAL(12,2) NOT NULL CONSTRAINT CK_ReservaDetalle_Descuento CHECK (Descuento >= 0),
    CONSTRAINT UQ_ReservaDetalle_Reserva_Variante UNIQUE (IDReserva, IDVariante),
    CONSTRAINT CK_ReservaDetalle_DescuentoMaximo CHECK (Descuento <= Cantidad * PrecioUnitario)
);
CREATE INDEX IX_ReservaDetalle_IDVariante ON dbo.ReservaDetalle (IDVariante) INCLUDE (IDReserva, Cantidad);
GO

------------------------------------------------------------
-- Pedidos
------------------------------------------------------------
CREATE TABLE dbo.PedidoEstados (
    Estado      NVARCHAR(20) NOT NULL CONSTRAINT PK_PedidoEstados PRIMARY KEY,
    Orden       INT          NOT NULL,
    EsFinal     BIT          NOT NULL
);
GO

-- Única fuente de las transiciones permitidas entre estados.
CREATE TABLE dbo.PedidoTransiciones (
    EstadoOrigen  NVARCHAR(20) NOT NULL CONSTRAINT FK_PedidoTransiciones_Origen REFERENCES dbo.PedidoEstados (Estado),
    EstadoDestino NVARCHAR(20) NOT NULL CONSTRAINT FK_PedidoTransiciones_Destino REFERENCES dbo.PedidoEstados (Estado),
    CONSTRAINT PK_PedidoTransiciones PRIMARY KEY (EstadoOrigen, EstadoDestino),
    CONSTRAINT CK_PedidoTransiciones_Distintos CHECK (EstadoOrigen <> EstadoDestino)
);
GO

INSERT INTO dbo.PedidoEstados (Estado, Orden, EsFinal) VALUES
    (N'Pagado', 1, 0),
    (N'EnPreparacion', 2, 0),
    (N'Despachado', 3, 0),
    (N'Entregado', 4, 0),
    (N'DevueltoParcial', 5, 0),
    (N'Devuelto', 6, 1),
    (N'Cancelado', 7, 1);

INSERT INTO dbo.PedidoTransiciones (EstadoOrigen, EstadoDestino) VALUES
    (N'Pagado', N'EnPreparacion'),
    (N'EnPreparacion', N'Despachado'),
    (N'Despachado', N'Entregado'),
    (N'Pagado', N'Cancelado'),
    (N'EnPreparacion', N'Cancelado'),
    (N'Entregado', N'DevueltoParcial'),
    (N'Entregado', N'Devuelto'),
    (N'DevueltoParcial', N'Devuelto');
GO

-- IDReserva es UNIQUE: una reserva produce como máximo un pedido.
-- El pago es simulado; ReferenciaPago identifica el único cobro del pedido.
CREATE TABLE dbo.Pedidos (
    IDPedido           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Pedidos PRIMARY KEY,
    IDUsuario          INT           NOT NULL CONSTRAINT FK_Pedidos_Usuarios REFERENCES dbo.Usuarios (IDUsuario),
    IDReserva          INT           NOT NULL CONSTRAINT FK_Pedidos_Reservas REFERENCES dbo.Reservas (IDReserva)
                                     CONSTRAINT UQ_Pedidos_IDReserva UNIQUE,
    Estado             NVARCHAR(20)  NOT NULL CONSTRAINT FK_Pedidos_PedidoEstados REFERENCES dbo.PedidoEstados (Estado),
    IDCupon            INT           NULL CONSTRAINT FK_Pedidos_Cupones REFERENCES dbo.Cupones (IDCupon),
    Subtotal           DECIMAL(12,2) NOT NULL CONSTRAINT CK_Pedidos_Subtotal CHECK (Subtotal >= 0),
    Descuento          DECIMAL(12,2) NOT NULL CONSTRAINT CK_Pedidos_Descuento CHECK (Descuento >= 0),
    Total              DECIMAL(12,2) NOT NULL CONSTRAINT CK_Pedidos_Total CHECK (Total >= 0),
    IVA                DECIMAL(12,2) NOT NULL CONSTRAINT CK_Pedidos_IVA CHECK (IVA >= 0),
    Direccion          NVARCHAR(300) NOT NULL,
    Ciudad             NVARCHAR(100) NOT NULL,
    Telefono           NVARCHAR(20)  NOT NULL,
    ReferenciaPago     NVARCHAR(40)  NOT NULL CONSTRAINT UQ_Pedidos_ReferenciaPago UNIQUE,
    FechaCreacion      DATETIME2(0)  NOT NULL CONSTRAINT DF_Pedidos_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion DATETIME2(0)  NOT NULL CONSTRAINT DF_Pedidos_FechaActualizacion DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Pedidos_Total_Calculo CHECK (Total = Subtotal - Descuento)
);
CREATE INDEX IX_Pedidos_IDUsuario ON dbo.Pedidos (IDUsuario, FechaCreacion DESC);
CREATE INDEX IX_Pedidos_Estado_Fecha ON dbo.Pedidos (Estado, FechaCreacion) INCLUDE (Total);
CREATE INDEX IX_Pedidos_Fecha ON dbo.Pedidos (FechaCreacion) INCLUDE (Estado, Total, IDUsuario);
GO

CREATE TABLE dbo.PedidoDetalle (
    IDPedidoDetalle  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PedidoDetalle PRIMARY KEY,
    IDPedido         INT           NOT NULL CONSTRAINT FK_PedidoDetalle_Pedidos REFERENCES dbo.Pedidos (IDPedido),
    IDVariante       INT           NOT NULL CONSTRAINT FK_PedidoDetalle_Variantes REFERENCES dbo.Variantes (IDVariante),
    Cantidad         INT           NOT NULL CONSTRAINT CK_PedidoDetalle_Cantidad CHECK (Cantidad > 0),
    PrecioUnitario   DECIMAL(12,2) NOT NULL CONSTRAINT CK_PedidoDetalle_Precio CHECK (PrecioUnitario >= 0),
    Descuento        DECIMAL(12,2) NOT NULL CONSTRAINT CK_PedidoDetalle_Descuento CHECK (Descuento >= 0),
    CantidadDevuelta INT           NOT NULL CONSTRAINT DF_PedidoDetalle_CantidadDevuelta DEFAULT (0),
    CONSTRAINT UQ_PedidoDetalle_Pedido_Variante UNIQUE (IDPedido, IDVariante),
    CONSTRAINT CK_PedidoDetalle_DescuentoMaximo CHECK (Descuento <= Cantidad * PrecioUnitario),
    CONSTRAINT CK_PedidoDetalle_Devuelta CHECK (CantidadDevuelta >= 0 AND CantidadDevuelta <= Cantidad)
);
CREATE INDEX IX_PedidoDetalle_IDVariante ON dbo.PedidoDetalle (IDVariante) INCLUDE (IDPedido, Cantidad, CantidadDevuelta);
GO

-- Cada cambio de estado con usuario, fecha, estado anterior y nuevo.
CREATE TABLE dbo.PedidoHistorial (
    IDPedidoHistorial INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PedidoHistorial PRIMARY KEY,
    IDPedido          INT           NOT NULL CONSTRAINT FK_PedidoHistorial_Pedidos REFERENCES dbo.Pedidos (IDPedido),
    EstadoAnterior    NVARCHAR(20)  NULL CONSTRAINT FK_PedidoHistorial_Anterior REFERENCES dbo.PedidoEstados (Estado),
    EstadoNuevo       NVARCHAR(20)  NOT NULL CONSTRAINT FK_PedidoHistorial_Nuevo REFERENCES dbo.PedidoEstados (Estado),
    IDUsuario         INT           NOT NULL CONSTRAINT FK_PedidoHistorial_Usuarios REFERENCES dbo.Usuarios (IDUsuario),
    Comentario        NVARCHAR(300) NULL,
    Fecha             DATETIME2(0)  NOT NULL CONSTRAINT DF_PedidoHistorial_Fecha DEFAULT (SYSUTCDATETIME())
);
CREATE INDEX IX_PedidoHistorial_IDPedido ON dbo.PedidoHistorial (IDPedido);
GO

-- Un uso por pedido. Al cancelar el pedido el uso se anula y deja de contar.
CREATE TABLE dbo.CuponUsos (
    IDCuponUso  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CuponUsos PRIMARY KEY,
    IDCupon     INT          NOT NULL CONSTRAINT FK_CuponUsos_Cupones REFERENCES dbo.Cupones (IDCupon),
    IDUsuario   INT          NOT NULL CONSTRAINT FK_CuponUsos_Usuarios REFERENCES dbo.Usuarios (IDUsuario),
    IDPedido    INT          NOT NULL CONSTRAINT FK_CuponUsos_Pedidos REFERENCES dbo.Pedidos (IDPedido)
                             CONSTRAINT UQ_CuponUsos_IDPedido UNIQUE,
    Anulado     BIT          NOT NULL CONSTRAINT DF_CuponUsos_Anulado DEFAULT (0),
    Fecha       DATETIME2(0) NOT NULL CONSTRAINT DF_CuponUsos_Fecha DEFAULT (SYSUTCDATETIME())
);
CREATE INDEX IX_CuponUsos_Cupon_Usuario ON dbo.CuponUsos (IDCupon, IDUsuario) WHERE Anulado = 0;
GO

------------------------------------------------------------
-- Devoluciones
------------------------------------------------------------
CREATE TABLE dbo.Devoluciones (
    IDDevolucion  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Devoluciones PRIMARY KEY,
    IDPedido      INT           NOT NULL CONSTRAINT FK_Devoluciones_Pedidos REFERENCES dbo.Pedidos (IDPedido),
    IDUsuario     INT           NOT NULL CONSTRAINT FK_Devoluciones_Usuarios REFERENCES dbo.Usuarios (IDUsuario),
    Motivo        NVARCHAR(300) NOT NULL,
    Monto         DECIMAL(12,2) NOT NULL CONSTRAINT CK_Devoluciones_Monto CHECK (Monto >= 0),
    Fecha         DATETIME2(0)  NOT NULL CONSTRAINT DF_Devoluciones_Fecha DEFAULT (SYSUTCDATETIME())
);
CREATE INDEX IX_Devoluciones_IDPedido ON dbo.Devoluciones (IDPedido);
GO

-- Monto = parte proporcional de la línea (precio menos descuento) por la cantidad devuelta.
CREATE TABLE dbo.DevolucionDetalle (
    IDDevolucionDetalle INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DevolucionDetalle PRIMARY KEY,
    IDDevolucion        INT           NOT NULL CONSTRAINT FK_DevolucionDetalle_Devoluciones REFERENCES dbo.Devoluciones (IDDevolucion),
    IDPedidoDetalle     INT           NOT NULL CONSTRAINT FK_DevolucionDetalle_PedidoDetalle REFERENCES dbo.PedidoDetalle (IDPedidoDetalle),
    Cantidad            INT           NOT NULL CONSTRAINT CK_DevolucionDetalle_Cantidad CHECK (Cantidad > 0),
    Monto               DECIMAL(12,2) NOT NULL CONSTRAINT CK_DevolucionDetalle_Monto CHECK (Monto >= 0),
    CONSTRAINT UQ_DevolucionDetalle_Linea UNIQUE (IDDevolucion, IDPedidoDetalle)
);
CREATE INDEX IX_DevolucionDetalle_IDPedidoDetalle ON dbo.DevolucionDetalle (IDPedidoDetalle);
GO

------------------------------------------------------------
-- Inventario: kardex
------------------------------------------------------------
-- Cantidad lleva signo: positiva entra, negativa sale.
-- La suma de Cantidad por variante es igual a Variantes.Existencia.
CREATE TABLE dbo.Kardex (
    IDKardex             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Kardex PRIMARY KEY,
    IDVariante           INT           NOT NULL CONSTRAINT FK_Kardex_Variantes REFERENCES dbo.Variantes (IDVariante),
    Tipo                 NVARCHAR(12)  NOT NULL CONSTRAINT CK_Kardex_Tipo CHECK (Tipo IN (N'Entrada', N'Salida', N'Ajuste', N'Devolucion')),
    Cantidad             INT           NOT NULL,
    ExistenciaResultante INT           NOT NULL CONSTRAINT CK_Kardex_ExistenciaResultante CHECK (ExistenciaResultante >= 0),
    Motivo               NVARCHAR(300) NOT NULL CONSTRAINT CK_Kardex_Motivo CHECK (LEN(Motivo) > 0),
    IDUsuario            INT           NULL CONSTRAINT FK_Kardex_Usuarios REFERENCES dbo.Usuarios (IDUsuario),
    IDPedido             INT           NULL CONSTRAINT FK_Kardex_Pedidos REFERENCES dbo.Pedidos (IDPedido),
    Fecha                DATETIME2(0)  NOT NULL CONSTRAINT DF_Kardex_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Kardex_Signo CHECK (
        (Tipo IN (N'Entrada', N'Devolucion') AND Cantidad > 0)
        OR (Tipo = N'Salida' AND Cantidad < 0)
        OR (Tipo = N'Ajuste' AND Cantidad <> 0)
    )
);
CREATE INDEX IX_Kardex_IDVariante_Fecha ON dbo.Kardex (IDVariante, Fecha);
GO

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
