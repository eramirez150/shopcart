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
CREATE UNIQUE INDEX UX_Carritos_TokenInvitado ON dbo.Carritos (TokenInvitado) WHERE Estado = N'Abierto' AND TokenInvitado IS NOT NULL;
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

