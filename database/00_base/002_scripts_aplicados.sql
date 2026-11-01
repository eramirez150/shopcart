-- Registro de los scripts de 01_tablas y 02_semillas ya aplicados: aplicar.sh
-- consulta esta tabla para ejecutar cada uno una sola vez. Se ejecuta dentro de la
-- base y se puede repetir sin efecto.
IF OBJECT_ID(N'dbo.ScriptsAplicados', N'U') IS NULL
    CREATE TABLE dbo.ScriptsAplicados (
        IDScriptAplicado INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ScriptsAplicados PRIMARY KEY,
        Nombre           NVARCHAR(200) NOT NULL CONSTRAINT UQ_ScriptsAplicados_Nombre UNIQUE,
        FechaAplicado    DATETIME2(0)  NOT NULL CONSTRAINT DF_ScriptsAplicados_FechaAplicado DEFAULT (SYSUTCDATETIME())
    );
GO
