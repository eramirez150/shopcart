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

