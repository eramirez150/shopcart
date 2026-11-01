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

