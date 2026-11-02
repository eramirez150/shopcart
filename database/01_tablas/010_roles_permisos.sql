------------------------------------------------------------
-- Roles y permisos
------------------------------------------------------------
-- Usuarios.Rol guarda el nombre del rol, por eso FU_Auth_Rol no cambia. El nombre se
-- puede corregir: la llave foránea lo propaga a los usuarios con ON UPDATE CASCADE.
-- Los roles de sistema (EsSistema = 1) no se editan ni se desactivan.
CREATE TABLE dbo.Roles (
    IDRol          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Roles PRIMARY KEY,
    Nombre         NVARCHAR(20)  NOT NULL CONSTRAINT UQ_Roles_Nombre UNIQUE
                                 CONSTRAINT CK_Roles_Nombre CHECK (LEN(Nombre) > 0),
    Descripcion    NVARCHAR(200) NULL,
    EsSistema      BIT           NOT NULL CONSTRAINT DF_Roles_EsSistema DEFAULT (0),
    Activo         BIT           NOT NULL CONSTRAINT DF_Roles_Activo DEFAULT (1),
    FechaCreacion  DATETIME2(0)  NOT NULL CONSTRAINT DF_Roles_FechaCreacion DEFAULT (SYSUTCDATETIME())
);
GO

-- Catálogo fijo: la API y los SP preguntan por Codigo. Asignable = 0 indica un permiso
-- que ningún rol puede recibir: solo lo tiene el Administrador.
CREATE TABLE dbo.Permisos (
    IDPermiso    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Permisos PRIMARY KEY,
    Codigo       NVARCHAR(50)  NOT NULL CONSTRAINT UQ_Permisos_Codigo UNIQUE,
    Modulo       NVARCHAR(20)  NOT NULL,
    Descripcion  NVARCHAR(200) NOT NULL,
    Asignable    BIT           NOT NULL CONSTRAINT DF_Permisos_Asignable DEFAULT (1)
);
GO

CREATE TABLE dbo.RolPermisos (
    IDRol      INT NOT NULL CONSTRAINT FK_RolPermisos_Roles REFERENCES dbo.Roles (IDRol),
    IDPermiso  INT NOT NULL CONSTRAINT FK_RolPermisos_Permisos REFERENCES dbo.Permisos (IDPermiso),
    CONSTRAINT PK_RolPermisos PRIMARY KEY (IDRol, IDPermiso)
);
GO

-- Estas filas son parte del modelo, no datos de demostración: van antes de los usuarios.
-- El Administrador no tiene filas en RolPermisos: FU_Auth_TienePermiso le concede todo.
INSERT INTO dbo.Roles (Nombre, Descripcion, EsSistema) VALUES
    (N'Administrador', N'Acceso total. Es el único que gestiona roles.', 1),
    (N'Operador',      N'Gestiona pedidos e inventario.', 0),
    (N'Cliente',       N'Compra en la tienda. No entra a administración.', 1);

INSERT INTO dbo.Permisos (Codigo, Modulo, Descripcion, Asignable) VALUES
    (N'pedidos.ver',          N'Pedidos',    N'Consultar pedidos y devoluciones', 1),
    (N'pedidos.gestionar',    N'Pedidos',    N'Cambiar estados y registrar devoluciones', 1),
    (N'inventario.ver',       N'Inventario', N'Consultar existencias y kardex', 1),
    (N'inventario.gestionar', N'Inventario', N'Registrar movimientos', 1),
    (N'catalogo.gestionar',   N'Catalogo',   N'Gestionar categorías, productos, variantes e imágenes', 1),
    (N'cupones.gestionar',    N'Cupones',    N'Gestionar cupones', 1),
    (N'usuarios.gestionar',   N'Usuarios',   N'Gestionar usuarios', 1),
    (N'reportes.ver',         N'Reportes',   N'Consultar el dashboard', 1),
    (N'bitacora.ver',         N'Bitacora',   N'Consultar la bitácora', 1),
    (N'roles.gestionar',      N'Roles',      N'Gestionar roles y permisos', 0);

INSERT INTO dbo.RolPermisos (IDRol, IDPermiso)
SELECT r.IDRol, p.IDPermiso
FROM dbo.Roles r
JOIN dbo.Permisos p ON p.Codigo IN (N'pedidos.ver', N'pedidos.gestionar', N'inventario.ver', N'inventario.gestionar')
WHERE r.Nombre = N'Operador';
GO

ALTER TABLE dbo.Usuarios ADD CONSTRAINT FK_Usuarios_Roles
    FOREIGN KEY (Rol) REFERENCES dbo.Roles (Nombre) ON UPDATE CASCADE;
CREATE INDEX IX_Usuarios_Rol ON dbo.Usuarios (Rol) WHERE Activo = 1;
GO

-- Triggers de bitácora, con las mismas reglas que los de 009_bitacora.sql.
CREATE TRIGGER dbo.TR_Roles_Bitacora ON dbo.Roles
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
    SELECT
        CAST(SESSION_CONTEXT(N'IDUsuario') AS INT),
        N'Roles', N'Rol', i.IDRol,
        CASE WHEN d.IDRol IS NULL THEN N'Creacion'
             WHEN d.Activo = 1 AND i.Activo = 0 THEN N'Desactivacion'
             ELSE N'Modificacion' END,
        (SELECT d.Nombre, d.Descripcion, d.Activo WHERE d.IDRol IS NOT NULL FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
        (SELECT i.Nombre, i.Descripcion, i.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    LEFT JOIN deleted d ON d.IDRol = i.IDRol
    WHERE d.IDRol IS NULL
       OR EXISTS (SELECT i.Nombre, i.Descripcion, i.Activo EXCEPT SELECT d.Nombre, d.Descripcion, d.Activo);
END;
GO

-- Una fila por permiso: agregarlo es Creacion y quitarlo es Eliminacion.
CREATE TRIGGER dbo.TR_RolPermisos_Bitacora ON dbo.RolPermisos
AFTER INSERT, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
    SELECT
        CAST(SESSION_CONTEXT(N'IDUsuario') AS INT),
        N'Roles', N'RolPermiso', COALESCE(i.IDRol, d.IDRol),
        CASE WHEN d.IDRol IS NULL THEN N'Creacion' ELSE N'Eliminacion' END,
        (SELECT p.Codigo AS Permiso WHERE d.IDRol IS NOT NULL FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
        (SELECT p.Codigo AS Permiso WHERE i.IDRol IS NOT NULL FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    FULL JOIN deleted d ON d.IDRol = i.IDRol AND d.IDPermiso = i.IDPermiso
    JOIN dbo.Permisos p ON p.IDPermiso = COALESCE(i.IDPermiso, d.IDPermiso);
END;
GO

-- Solo registra los cambios de rol de los usuarios.
CREATE TRIGGER dbo.TR_Usuarios_Bitacora ON dbo.Usuarios
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
    SELECT
        CAST(SESSION_CONTEXT(N'IDUsuario') AS INT),
        N'Roles', N'Usuario', i.IDUsuario, N'Modificacion',
        (SELECT d.Rol FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
        (SELECT i.Rol FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    JOIN deleted d ON d.IDUsuario = i.IDUsuario
    WHERE d.Rol <> i.Rol;
END;
GO
