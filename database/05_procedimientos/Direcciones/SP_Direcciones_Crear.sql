------------------------------------------------------------
-- Direcciones de entrega
------------------------------------------------------------
-- Registra una dirección del usuario autenticado. El dueño sale del JWT.
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Crear
    @IDUsuario INT,
    @Direccion NVARCHAR(300),
    @Ciudad    NVARCHAR(100),
    @Telefono  NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    IF dbo.FU_Auth_Rol(@IDUsuario) IS NULL THROW 52403, N'Usuario no autorizado.', 1;
    IF ISNULL(LEN(LTRIM(RTRIM(@Direccion))), 0) = 0 OR ISNULL(LEN(LTRIM(RTRIM(@Ciudad))), 0) = 0
       OR ISNULL(LEN(LTRIM(RTRIM(@Telefono))), 0) = 0
        THROW 52400, N'La dirección, la ciudad y el teléfono son obligatorios.', 1;

    INSERT INTO dbo.Direcciones (IDUsuario, Direccion, Ciudad, Telefono)
    VALUES (@IDUsuario, LTRIM(RTRIM(@Direccion)), LTRIM(RTRIM(@Ciudad)), LTRIM(RTRIM(@Telefono)));

    SELECT IDDireccion, Direccion, Ciudad, Telefono, Activa, FechaCreacion
    FROM dbo.Direcciones WHERE IDDireccion = SCOPE_IDENTITY();
END;
GO
