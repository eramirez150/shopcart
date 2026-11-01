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


-- Direcciones de entrega de cada usuario. Solo el dueño las ve y las modifica.
-- No se borran: se desactivan, porque las reservas y los pedidos las referencian.
-- Reservas y Pedidos copian además el texto, así un cambio posterior no altera un pedido.
CREATE TABLE dbo.Direcciones (
    IDDireccion     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Direcciones PRIMARY KEY,
    IDUsuario       INT           NOT NULL CONSTRAINT FK_Direcciones_Usuarios REFERENCES dbo.Usuarios (IDUsuario),
    Direccion       NVARCHAR(300) NOT NULL CONSTRAINT CK_Direcciones_Direccion CHECK (LEN(Direccion) > 0),
    Ciudad          NVARCHAR(100) NOT NULL CONSTRAINT CK_Direcciones_Ciudad CHECK (LEN(Ciudad) > 0),
    Telefono        NVARCHAR(20)  NOT NULL CONSTRAINT CK_Direcciones_Telefono CHECK (LEN(Telefono) > 0),
    Activa          BIT           NOT NULL CONSTRAINT DF_Direcciones_Activa DEFAULT (1),
    FechaCreacion   DATETIME2(0)  NOT NULL CONSTRAINT DF_Direcciones_FechaCreacion DEFAULT (SYSUTCDATETIME())
);
CREATE INDEX IX_Direcciones_IDUsuario ON dbo.Direcciones (IDUsuario) WHERE Activa = 1;
GO
