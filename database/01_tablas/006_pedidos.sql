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

