-- Modifica una dirección activa del usuario. La de otro usuario responde como
-- inexistente (404). Las reservas y los pedidos ya creados conservan el texto copiado.
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Actualizar
    @IDUsuario   INT,
    @IDDireccion INT,
    @Direccion   NVARCHAR(300),
    @Ciudad      NVARCHAR(100),
    @Telefono    NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    IF dbo.FU_Auth_Rol(@IDUsuario) IS NULL THROW 52403, N'Usuario no autorizado.', 1;
    IF ISNULL(LEN(LTRIM(RTRIM(@Direccion))), 0) = 0 OR ISNULL(LEN(LTRIM(RTRIM(@Ciudad))), 0) = 0
       OR ISNULL(LEN(LTRIM(RTRIM(@Telefono))), 0) = 0
        THROW 52400, N'La dirección, la ciudad y el teléfono son obligatorios.', 1;

    UPDATE dbo.Direcciones
    SET Direccion = LTRIM(RTRIM(@Direccion)), Ciudad = LTRIM(RTRIM(@Ciudad)), Telefono = LTRIM(RTRIM(@Telefono))
    WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario AND Activa = 1;

    IF @@ROWCOUNT = 0 THROW 52404, N'La dirección no existe.', 1;

    SELECT IDDireccion, Direccion, Ciudad, Telefono, Activa, FechaCreacion
    FROM dbo.Direcciones WHERE IDDireccion = @IDDireccion;
END;
GO
