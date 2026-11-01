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

