-- La API lo consulta en cada petición de administración: un cambio de permisos
-- tiene efecto inmediato, sin esperar a que venza el token.
CREATE OR ALTER PROCEDURE dbo.SP_Auth_TienePermiso
    @IDUsuario INT,
    @Codigo    NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT dbo.FU_Auth_TienePermiso(@IDUsuario, @Codigo) AS Tiene;
END;
GO
