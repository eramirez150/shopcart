CREATE OR ALTER PROCEDURE dbo.SP_Auth_GuardarRefresh
    @IDUsuario INT,
    @TokenHash CHAR(64),
    @Expira    DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.RefreshTokens (IDUsuario, TokenHash, Expira) VALUES (@IDUsuario, @TokenHash, @Expira);
END;
GO
