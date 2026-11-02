CREATE OR ALTER PROCEDURE dbo.SP_Auth_RevocarRefresh
    @TokenHash CHAR(64),
    @Audiencia NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.RefreshTokens SET FechaRevocado = SYSUTCDATETIME()
    WHERE TokenHash = @TokenHash AND Audiencia = @Audiencia AND FechaRevocado IS NULL;
END;
GO
