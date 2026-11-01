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
    IDDireccion      INT           NOT NULL CONSTRAINT FK_Reservas_Direcciones REFERENCES dbo.Direcciones (IDDireccion),
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

