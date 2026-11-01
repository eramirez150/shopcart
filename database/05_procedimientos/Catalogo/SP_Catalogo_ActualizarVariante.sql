-- Cambia SKU, atributos, precio o estado. La existencia solo cambia por el kardex.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarVariante
    @IDUsuario  INT,
    @IDVariante INT,
    @SKU        NVARCHAR(40),
    @Atributos  NVARCHAR(400) = N'{}',
    @Precio     DECIMAL(12,2),
    @Activa     BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF ISNULL(dbo.FU_Auth_Rol(@IDUsuario), N'') <> N'Administrador'
        THROW 52403, N'Solo el Administrador gestiona el catálogo.', 1;
    DECLARE @IDProducto INT = (SELECT IDProducto FROM dbo.Variantes WHERE IDVariante = @IDVariante);
    IF @IDProducto IS NULL THROW 52404, N'La variante no existe.', 1;
    IF @Precio < 0 THROW 52400, N'El precio no puede ser negativo.', 1;
    IF ISJSON(@Atributos) <> 1 THROW 52400, N'Los atributos deben ser un objeto JSON.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Variantes WHERE SKU = LTRIM(RTRIM(@SKU)) AND IDVariante <> @IDVariante)
        THROW 52409, N'El SKU ya existe.', 1;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;
    UPDATE dbo.Variantes SET SKU = LTRIM(RTRIM(@SKU)), Atributos = @Atributos, Precio = @Precio, Activa = @Activa
    WHERE IDVariante = @IDVariante;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto = @IDProducto, @IncluirInactivos = 1;
END;
GO
