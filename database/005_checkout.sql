-- Checkout: reserva de 15 minutos con precio y descuento congelados.

-- Devuelve la reserva (encabezado y líneas) de un cliente.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_ObtenerReserva
    @IDUsuario INT,
    @IDReserva INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Reservas WHERE IDReserva = @IDReserva AND IDUsuario = @IDUsuario)
        THROW 52404, N'La reserva no existe.', 1;

    SELECT r.IDReserva, r.Estado, r.Expira,
           CASE WHEN r.Estado = N'Activa' AND r.Expira <= SYSUTCDATETIME() THEN 1 ELSE 0 END AS Vencida,
           c.Codigo AS Cupon, r.Subtotal, r.Descuento, r.Total,
           r.Direccion, r.Ciudad, r.Telefono
    FROM dbo.Reservas r
    LEFT JOIN dbo.Cupones c ON c.IDCupon = r.IDCupon
    WHERE r.IDReserva = @IDReserva;

    SELECT rd.IDVariante, v.SKU, p.Nombre AS Producto, rd.Cantidad, rd.PrecioUnitario, rd.Descuento
    FROM dbo.ReservaDetalle rd
    JOIN dbo.Variantes v ON v.IDVariante = rd.IDVariante
    JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
    WHERE rd.IDReserva = @IDReserva
    ORDER BY rd.IDVariante;
END;
GO

-- Inicia el pago: reserva la existencia del carrito abierto del cliente.
-- Las variantes se bloquean con UPDLOCK, HOLDLOCK en orden de IDVariante, así dos
-- compras simultáneas no leen el mismo disponible ni se bloquean entre sí.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_IniciarPago
    @IDUsuario INT,
    @Direccion NVARCHAR(300),
    @Ciudad    NVARCHAR(100),
    @Telefono  NVARCHAR(20),
    @Codigo    NVARCHAR(30) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF dbo.FU_Auth_Rol(@IDUsuario) IS NULL THROW 52403, N'Usuario no autorizado.', 1;

    IF ISNULL(LEN(LTRIM(RTRIM(@Direccion))), 0) = 0 OR ISNULL(LEN(LTRIM(RTRIM(@Ciudad))), 0) = 0
       OR ISNULL(LEN(LTRIM(RTRIM(@Telefono))), 0) = 0
        THROW 52400, N'La dirección, la ciudad y el teléfono son obligatorios.', 1;

    DECLARE @IDCarrito INT, @IDCupon INT, @IDReserva INT;
    DECLARE @Lineas TABLE (
        IDVariante INT PRIMARY KEY, SKU NVARCHAR(40), Cantidad INT,
        Activa BIT, ProductoActivo BIT
    );
    DECLARE @Calculo TABLE (
        IDVariante INT PRIMARY KEY, Cantidad INT, PrecioUnitario DECIMAL(12,2),
        Subtotal DECIMAL(12,2), Descuento DECIMAL(12,2)
    );

    BEGIN TRY
        BEGIN TRANSACTION;

        -- El bloqueo del carrito serializa dos inicios de pago del mismo cliente.
        SELECT @IDCarrito = IDCarrito, @IDCupon = IDCupon
        FROM dbo.Carritos WITH (UPDLOCK, HOLDLOCK)
        WHERE IDUsuario = @IDUsuario AND Estado = N'Abierto';

        IF @IDCarrito IS NULL THROW 52404, N'El cliente no tiene un carrito abierto.', 1;

        -- Una reserva activa anterior, vencida o no, libera su lugar: se anula
        -- antes de crear la nueva (hay un índice único de reserva activa por carrito).
        UPDATE dbo.Reservas SET Estado = N'Anulada'
        WHERE IDCarrito = @IDCarrito AND Estado = N'Activa';

        INSERT INTO @Lineas (IDVariante, SKU, Cantidad, Activa, ProductoActivo)
        SELECT v.IDVariante, v.SKU, cd.Cantidad, v.Activa, p.Activo
        FROM dbo.CarritoDetalle cd
        JOIN dbo.Variantes v WITH (UPDLOCK, HOLDLOCK) ON v.IDVariante = cd.IDVariante
        JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
        WHERE cd.IDCarrito = @IDCarrito
        ORDER BY v.IDVariante;

        IF NOT EXISTS (SELECT 1 FROM @Lineas) THROW 52400, N'El carrito está vacío.', 1;

        DECLARE @Problema NVARCHAR(200) = (
            SELECT TOP (1) N'El producto ' + l.SKU + N' ya no está disponible.'
            FROM @Lineas l WHERE l.Activa = 0 OR l.ProductoActivo = 0 ORDER BY l.IDVariante);
        IF @Problema IS NOT NULL THROW 52409, @Problema, 1;

        SET @Problema = (
            SELECT TOP (1) N'No hay existencia suficiente de ' + l.SKU + N': disponible '
                   + CAST(d.Disponible AS NVARCHAR(10)) + N'.'
            FROM @Lineas l
            JOIN dbo.FU_Inventario_Disponibilidad() d ON d.IDVariante = l.IDVariante
            WHERE l.Cantidad > d.Disponible ORDER BY l.IDVariante);
        IF @Problema IS NOT NULL THROW 52409, @Problema, 1;

        -- Un código recibido reemplaza al cupón del carrito. Se valida otra vez
        -- porque pudo cambiar el carrito o la vigencia desde que se aplicó.
        IF @Codigo IS NOT NULL AND LEN(LTRIM(RTRIM(@Codigo))) > 0
            EXEC dbo.SP_Cupones_Validar @IDUsuario = @IDUsuario, @IDCarrito = @IDCarrito,
                                        @Codigo = @Codigo, @IDCupon = @IDCupon OUTPUT;
        ELSE IF @IDCupon IS NOT NULL
        BEGIN
            DECLARE @CodigoCarrito NVARCHAR(30) = (SELECT Codigo FROM dbo.Cupones WHERE IDCupon = @IDCupon);
            EXEC dbo.SP_Cupones_Validar @IDUsuario = @IDUsuario, @IDCarrito = @IDCarrito,
                                        @Codigo = @CodigoCarrito, @IDCupon = @IDCupon OUTPUT;
        END;

        INSERT INTO @Calculo (IDVariante, Cantidad, PrecioUnitario, Subtotal, Descuento)
        SELECT IDVariante, Cantidad, PrecioUnitario, Subtotal, Descuento
        FROM dbo.FU_Cupones_CalculoDescuento(@IDCarrito, @IDCupon);

        INSERT INTO dbo.Reservas (IDUsuario, IDCarrito, Estado, Expira, IDCupon, Subtotal, Descuento, Total,
                                  Direccion, Ciudad, Telefono)
        SELECT @IDUsuario, @IDCarrito, N'Activa', DATEADD(MINUTE, 15, SYSUTCDATETIME()), @IDCupon,
               SUM(Subtotal), SUM(Descuento), SUM(Subtotal) - SUM(Descuento),
               LTRIM(RTRIM(@Direccion)), LTRIM(RTRIM(@Ciudad)), LTRIM(RTRIM(@Telefono))
        FROM @Calculo;

        SET @IDReserva = SCOPE_IDENTITY();

        INSERT INTO dbo.ReservaDetalle (IDReserva, IDVariante, Cantidad, PrecioUnitario, Descuento)
        SELECT @IDReserva, IDVariante, Cantidad, PrecioUnitario, Descuento FROM @Calculo;

        UPDATE dbo.Carritos SET IDCupon = @IDCupon, FechaActualizacion = SYSUTCDATETIME()
        WHERE IDCarrito = @IDCarrito;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Checkout_ObtenerReserva @IDUsuario = @IDUsuario, @IDReserva = @IDReserva;
END;
GO

-- Cancela el pago: la reserva activa se anula y su existencia queda libre.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_CancelarPago
    @IDUsuario INT,
    @IDReserva INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Reservas SET Estado = N'Anulada'
    WHERE IDReserva = @IDReserva AND IDUsuario = @IDUsuario AND Estado = N'Activa';

    IF @@ROWCOUNT = 0
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.Reservas WHERE IDReserva = @IDReserva AND IDUsuario = @IDUsuario)
            THROW 52404, N'La reserva no existe.', 1;
        THROW 52409, N'La reserva ya no está activa.', 1;
    END;

    EXEC dbo.SP_Checkout_ObtenerReserva @IDUsuario = @IDUsuario, @IDReserva = @IDReserva;
END;
GO
