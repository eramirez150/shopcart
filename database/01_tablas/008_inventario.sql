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

