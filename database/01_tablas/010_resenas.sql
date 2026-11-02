------------------------------------------------------------
-- Reseñas de producto
------------------------------------------------------------
-- Una reseña por usuario y producto. Quién puede reseñar lo valida SP_Resenas_Crear.
CREATE TABLE dbo.Resenas (
    IDResena     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Resenas PRIMARY KEY,
    IDProducto   INT            NOT NULL CONSTRAINT FK_Resenas_Productos REFERENCES dbo.Productos (IDProducto),
    IDUsuario    INT            NOT NULL CONSTRAINT FK_Resenas_Usuarios REFERENCES dbo.Usuarios (IDUsuario),
    Calificacion INT            NOT NULL CONSTRAINT CK_Resenas_Calificacion CHECK (Calificacion BETWEEN 1 AND 5),
    Comentario   NVARCHAR(1000) NOT NULL CONSTRAINT CK_Resenas_Comentario CHECK (LEN(Comentario) > 0),
    Fecha        DATETIME2(0)   NOT NULL CONSTRAINT DF_Resenas_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Resenas_Producto_Usuario UNIQUE (IDProducto, IDUsuario)
);
CREATE INDEX IX_Resenas_Producto_Fecha ON dbo.Resenas (IDProducto, Fecha DESC);
GO
