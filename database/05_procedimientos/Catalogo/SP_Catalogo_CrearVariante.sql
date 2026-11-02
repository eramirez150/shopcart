-- La existencia inicial entra por el kardex, como cualquier otro movimiento.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearVariante
    @IDUsuario         INT,
    @IDProducto        INT,
    @SKU               NVARCHAR(40),
    @Atributos         NVARCHAR(400) = N'{}',
    @Precio            DECIMAL(12,2),
    @ExistenciaInicial INT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF dbo.FU_Auth_TienePermiso(@IDUsuario, N'catalogo.gestionar') = 0
        THROW 52403, N'No tiene permiso para gestionar el catálogo.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE IDProducto = @IDProducto)
        THROW 52404, N'El producto no existe.', 1;
    IF @Precio < 0 THROW 52400, N'El precio no puede ser negativo.', 1;
    IF @ExistenciaInicial < 0 THROW 52400, N'La existencia inicial no puede ser negativa.', 1;
    IF ISJSON(@Atributos) <> 1 THROW 52400, N'Los atributos deben ser un objeto JSON.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Variantes WHERE SKU = LTRIM(RTRIM(@SKU)))
        THROW 52409, N'El SKU ya existe.', 1;

    DECLARE @IDVariante INT;
    BEGIN TRANSACTION;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;
    INSERT INTO dbo.Variantes (IDProducto, SKU, Atributos, Precio) VALUES (@IDProducto, LTRIM(RTRIM(@SKU)), @Atributos, @Precio);
    SET @IDVariante = SCOPE_IDENTITY();
    IF @ExistenciaInicial > 0
        EXEC dbo.SP_Inventario_RegistrarMovimiento @IDVariante = @IDVariante, @Tipo = N'Entrada',
             @Cantidad = @ExistenciaInicial, @Motivo = N'Inventario inicial', @IDUsuario = @IDUsuario;
    COMMIT TRANSACTION;

    EXEC dbo.SP_Catalogo_ObtenerProducto @IDProducto = @IDProducto, @IncluirInactivos = 1;
END;
GO
