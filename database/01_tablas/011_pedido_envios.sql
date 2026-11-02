------------------------------------------------------------
-- Envíos: datos del despacho y de la entrega de un pedido
------------------------------------------------------------
-- Una fila por pedido. Nace al pasar a Despachado y se completa al pasar a Entregado.
-- CostoRecogida es lo que cobra la mensajería: solo lo ve administración.
CREATE TABLE dbo.PedidoEnvios (
    IDPedido      INT           NOT NULL CONSTRAINT PK_PedidoEnvios PRIMARY KEY
                                CONSTRAINT FK_PedidoEnvios_Pedidos REFERENCES dbo.Pedidos (IDPedido),
    Mensajeria    NVARCHAR(100) NOT NULL,
    Guia          NVARCHAR(60)  NOT NULL,
    PesoKg        DECIMAL(8,2)  NOT NULL CONSTRAINT CK_PedidoEnvios_PesoKg CHECK (PesoKg > 0),
    CostoRecogida DECIMAL(12,2) NOT NULL CONSTRAINT CK_PedidoEnvios_CostoRecogida CHECK (CostoRecogida >= 0),
    RecibidoPor   NVARCHAR(150) NULL,
    FechaDespacho DATETIME2(0)  NOT NULL CONSTRAINT DF_PedidoEnvios_FechaDespacho DEFAULT (SYSUTCDATETIME()),
    FechaEntrega  DATETIME2(0)  NULL
);
GO
