-- Inicia el pago: reserva la existencia del carrito abierto del cliente.
-- Repetir la llamada con el carrito sin cambios devuelve la misma reserva (doble clic).
-- La dirección se elige con @IDDireccion (debe ser del cliente y estar activa) o se
-- registra en ese momento con @Direccion, @Ciudad y @Telefono; si el cliente ya tiene
-- una dirección activa idéntica se reutiliza. El texto se copia en la reserva.
-- Las variantes se bloquean con UPDLOCK, HOLDLOCK en orden de IDVariante, así dos
-- compras simultáneas no leen el mismo disponible ni se bloquean entre sí.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_IniciarPago
    @IDUsuario   INT,
    @IDDireccion INT = NULL,
    @Direccion   NVARCHAR(300) = NULL,
    @Ciudad      NVARCHAR(100) = NULL,
    @Telefono    NVARCHAR(20) = NULL,
    @Codigo      NVARCHAR(30) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF dbo.FU_Auth_Rol(@IDUsuario) IS NULL THROW 52403, N'Usuario no autorizado.', 1;

    SET @Direccion = LTRIM(RTRIM(@Direccion));
    SET @Ciudad = LTRIM(RTRIM(@Ciudad));
    SET @Telefono = LTRIM(RTRIM(@Telefono));
    IF @IDDireccion IS NULL AND (ISNULL(LEN(@Direccion), 0) = 0 OR ISNULL(LEN(@Ciudad), 0) = 0 OR ISNULL(LEN(@Telefono), 0) = 0)
        THROW 52400, N'Seleccione una dirección o indique la dirección, la ciudad y el teléfono.', 1;

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

        -- Dirección: la elegida debe ser del cliente; una nueva se registra.
        IF @IDDireccion IS NOT NULL
        BEGIN
            SELECT @Direccion = Direccion, @Ciudad = Ciudad, @Telefono = Telefono
            FROM dbo.Direcciones
            WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario AND Activa = 1;
            IF @@ROWCOUNT = 0 THROW 52404, N'La dirección no existe.', 1;
        END
        ELSE
        BEGIN
            SELECT TOP (1) @IDDireccion = IDDireccion
            FROM dbo.Direcciones
            WHERE IDUsuario = @IDUsuario AND Activa = 1
              AND Direccion = @Direccion AND Ciudad = @Ciudad AND Telefono = @Telefono
            ORDER BY IDDireccion;
            IF @IDDireccion IS NULL
            BEGIN
                INSERT INTO dbo.Direcciones (IDUsuario, Direccion, Ciudad, Telefono)
                VALUES (@IDUsuario, @Direccion, @Ciudad, @Telefono);
                SET @IDDireccion = SCOPE_IDENTITY();
            END;
        END;

        -- Doble clic: si el carrito ya tiene una reserva activa y no vencida con la misma
        -- dirección y el mismo cupón, se devuelve esa reserva sin anularla. Cualquier cambio
        -- del carrito anula su reserva, así que una reserva activa implica un carrito sin
        -- cambios. Un código que no existe nunca coincide y se rechaza más abajo.
        DECLARE @IDCuponPedido INT = @IDCupon;
        IF @Codigo IS NOT NULL AND LEN(LTRIM(RTRIM(@Codigo))) > 0
            SET @IDCuponPedido = ISNULL((SELECT IDCupon FROM dbo.Cupones WHERE Codigo = LTRIM(RTRIM(@Codigo))), -1);

        SELECT @IDReserva = IDReserva
        FROM dbo.Reservas
        WHERE IDCarrito = @IDCarrito AND Estado = N'Activa' AND Expira > SYSUTCDATETIME()
          AND IDDireccion = @IDDireccion
          AND (IDCupon = @IDCuponPedido OR (IDCupon IS NULL AND @IDCuponPedido IS NULL));

        IF @IDReserva IS NOT NULL
        BEGIN
            COMMIT TRANSACTION;
            EXEC dbo.SP_Checkout_ObtenerReserva @IDUsuario = @IDUsuario, @IDReserva = @IDReserva;
            RETURN;
        END;

        -- Otra reserva activa (vencida, o con otra dirección o cupón) libera su lugar:
        -- se anula antes de crear la nueva (hay un índice único de reserva activa por carrito).
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
                                  IDDireccion, Direccion, Ciudad, Telefono)
        SELECT @IDUsuario, @IDCarrito, N'Activa', DATEADD(MINUTE, 15, SYSUTCDATETIME()), @IDCupon,
               SUM(Subtotal), SUM(Descuento), SUM(Subtotal) - SUM(Descuento),
               @IDDireccion, @Direccion, @Ciudad, @Telefono
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
