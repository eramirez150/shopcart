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

