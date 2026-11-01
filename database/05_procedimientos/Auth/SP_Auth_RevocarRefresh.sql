CREATE OR ALTER PROCEDURE dbo.SP_Auth_RevocarRefresh
    @TokenHash CHAR(64)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.RefreshTokens SET FechaRevocado = SYSUTCDATETIME()
    WHERE TokenHash = @TokenHash AND FechaRevocado IS NULL;
END;
GO
