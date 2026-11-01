-- Carrito de un usuario o de un invitado identificado por token.
-- Cualquier cambio en el carrito anula su reserva activa: el cliente debe iniciar
-- el pago otra vez y se recalculan existencia, precios y descuento.

-- Busca el carrito abierto del usuario o del invitado; con @Crear = 1 lo crea si no existe.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Resolver
    @IDUsuario     INT = NULL,
    @TokenInvitado UNIQUEIDENTIFIER = NULL,
    @Crear         BIT = 1,
    @IDCarrito     INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @IDCarrito = NULL;

    IF @IDUsuario IS NOT NULL
        SELECT @IDCarrito = IDCarrito FROM dbo.Carritos WHERE IDUsuario = @IDUsuario AND Estado = N'Abierto';
    ELSE IF @TokenInvitado IS NOT NULL
        SELECT @IDCarrito = IDCarrito FROM dbo.Carritos
        WHERE TokenInvitado = @TokenInvitado AND IDUsuario IS NULL AND Estado = N'Abierto';
    ELSE IF @Crear = 0
        RETURN;

    IF @IDCarrito IS NULL AND @Crear = 1
    BEGIN
        IF @IDUsuario IS NOT NULL
            INSERT INTO dbo.Carritos (IDUsuario) VALUES (@IDUsuario);
        ELSE
            INSERT INTO dbo.Carritos (TokenInvitado) VALUES (NEWID());
        SET @IDCarrito = SCOPE_IDENTITY();
    END;
END;
GO

-- Encabezado (con subtotal, descuento y total) y líneas del carrito.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Consultar
    @IDCarrito INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDCupon INT = (SELECT IDCupon FROM dbo.Carritos WHERE IDCarrito = @IDCarrito);
    DECLARE @Calculo TABLE (IDVariante INT PRIMARY KEY, Cantidad INT, PrecioUnitario DECIMAL(12,2),
                            Subtotal DECIMAL(12,2), Descuento DECIMAL(12,2));
    INSERT INTO @Calculo SELECT IDVariante, Cantidad, PrecioUnitario, Subtotal, Descuento
    FROM dbo.FU_Cupones_CalculoDescuento(@IDCarrito, @IDCupon);

    SELECT c.IDCarrito, c.TokenInvitado, cu.Codigo AS Cupon,
           ISNULL((SELECT SUM(Subtotal) FROM @Calculo), 0) AS Subtotal,
           ISNULL((SELECT SUM(Descuento) FROM @Calculo), 0) AS Descuento,
           ISNULL((SELECT SUM(Subtotal) - SUM(Descuento) FROM @Calculo), 0) AS Total
    FROM dbo.Carritos c
    LEFT JOIN dbo.Cupones cu ON cu.IDCupon = c.IDCupon
    WHERE c.IDCarrito = @IDCarrito;

    SELECT k.IDVariante, v.SKU, p.Nombre AS Producto, v.Atributos, k.Cantidad, k.PrecioUnitario,
           k.Subtotal, k.Descuento, k.Subtotal - k.Descuento AS Total, d.Disponible
    FROM @Calculo k
    JOIN dbo.Variantes v ON v.IDVariante = k.IDVariante
    JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
    JOIN dbo.FU_Inventario_Disponibilidad() d ON d.IDVariante = k.IDVariante
    ORDER BY k.IDVariante;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Obtener
    @IDUsuario     INT = NULL,
    @TokenInvitado UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IDCarrito INT;
    EXEC dbo.SP_Carrito_Resolver @IDUsuario = @IDUsuario, @TokenInvitado = @TokenInvitado, @Crear = 1, @IDCarrito = @IDCarrito OUTPUT;
    EXEC dbo.SP_Carrito_Consultar @IDCarrito = @IDCarrito;
END;
GO

-- Fija la cantidad de una línea (o la suma, con @Sumar = 1) sin superar el disponible.
-- Cantidad 0 elimina la línea. Uso interno de los SP de agregar, modificar y eliminar.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_FijarCantidad
    @IDCarrito  INT,
    @IDVariante INT,
    @Cantidad   INT,
    @Sumar      BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @@TRANCOUNT = 0 THROW 52500, N'Debe ejecutarse dentro de una transacción.', 1;

    -- Anula la reserva activa del carrito: el cambio invalida lo reservado.
    UPDATE dbo.Reservas SET Estado = N'Anulada' WHERE IDCarrito = @IDCarrito AND Estado = N'Activa';

    -- El bloqueo de la variante serializa cambios simultáneos sobre la misma línea.
    DECLARE @Activa BIT, @ProductoActivo BIT;
    SELECT @Activa = v.Activa, @ProductoActivo = p.Activo
    FROM dbo.Variantes v WITH (UPDLOCK, HOLDLOCK)
    JOIN dbo.Productos p ON p.IDProducto = v.IDProducto
    WHERE v.IDVariante = @IDVariante;

    DECLARE @Actual INT = ISNULL((SELECT Cantidad FROM dbo.CarritoDetalle
                                  WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante), 0);
    DECLARE @Nueva INT = CASE WHEN @Sumar = 1 THEN @Actual + @Cantidad ELSE @Cantidad END;

    IF @Nueva > 0
    BEGIN
        IF @Activa IS NULL THROW 52404, N'La variante no existe.', 1;
        IF @Activa = 0 OR @ProductoActivo = 0 THROW 52409, N'El producto no está disponible.', 1;

        DECLARE @Disponible INT = (SELECT Disponible FROM dbo.FU_Inventario_Disponibilidad() WHERE IDVariante = @IDVariante);
        IF @Nueva > @Disponible
            THROW 52409, N'La cantidad supera el disponible.', 1;

        IF @Actual = 0
            INSERT INTO dbo.CarritoDetalle (IDCarrito, IDVariante, Cantidad) VALUES (@IDCarrito, @IDVariante, @Nueva);
        ELSE
            UPDATE dbo.CarritoDetalle SET Cantidad = @Nueva WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;
    END
    ELSE
        DELETE FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

    UPDATE dbo.Carritos SET FechaActualizacion = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Agregar
    @IDUsuario     INT = NULL,
    @TokenInvitado UNIQUEIDENTIFIER = NULL,
    @IDVariante    INT,
    @Cantidad      INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @Cantidad <= 0 THROW 52400, N'La cantidad debe ser mayor que cero.', 1;

    DECLARE @IDCarrito INT;
    BEGIN TRY
        BEGIN TRANSACTION;
        EXEC dbo.SP_Carrito_Resolver @IDUsuario = @IDUsuario, @TokenInvitado = @TokenInvitado, @Crear = 1, @IDCarrito = @IDCarrito OUTPUT;
        EXEC dbo.SP_Carrito_FijarCantidad @IDCarrito = @IDCarrito, @IDVariante = @IDVariante, @Cantidad = @Cantidad, @Sumar = 1;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
    EXEC dbo.SP_Carrito_Consultar @IDCarrito = @IDCarrito;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Modificar
    @IDUsuario     INT = NULL,
    @TokenInvitado UNIQUEIDENTIFIER = NULL,
    @IDVariante    INT,
    @Cantidad      INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @Cantidad <= 0 THROW 52400, N'La cantidad debe ser mayor que cero. Para quitar la línea use eliminar.', 1;

    DECLARE @IDCarrito INT;
    EXEC dbo.SP_Carrito_Resolver @IDUsuario = @IDUsuario, @TokenInvitado = @TokenInvitado, @Crear = 0, @IDCarrito = @IDCarrito OUTPUT;
    IF @IDCarrito IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante)
        THROW 52404, N'El producto no está en el carrito.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        EXEC dbo.SP_Carrito_FijarCantidad @IDCarrito = @IDCarrito, @IDVariante = @IDVariante, @Cantidad = @Cantidad, @Sumar = 0;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
    EXEC dbo.SP_Carrito_Consultar @IDCarrito = @IDCarrito;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Eliminar
    @IDUsuario     INT = NULL,
    @TokenInvitado UNIQUEIDENTIFIER = NULL,
    @IDVariante    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCarrito INT;
    EXEC dbo.SP_Carrito_Resolver @IDUsuario = @IDUsuario, @TokenInvitado = @TokenInvitado, @Crear = 0, @IDCarrito = @IDCarrito OUTPUT;
    IF @IDCarrito IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante)
        THROW 52404, N'El producto no está en el carrito.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        EXEC dbo.SP_Carrito_FijarCantidad @IDCarrito = @IDCarrito, @IDVariante = @IDVariante, @Cantidad = 0, @Sumar = 0;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
    EXEC dbo.SP_Carrito_Consultar @IDCarrito = @IDCarrito;
END;
GO

-- Un cupón por pedido: aplicar uno nuevo reemplaza al anterior.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_AplicarCupon
    @IDUsuario     INT = NULL,
    @TokenInvitado UNIQUEIDENTIFIER = NULL,
    @Codigo        NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- El cupón tiene límite por cliente, por lo que exige una cuenta.
    IF @IDUsuario IS NULL THROW 52401, N'Inicie sesión para aplicar un cupón.', 1;

    DECLARE @IDCarrito INT, @IDCupon INT;
    EXEC dbo.SP_Carrito_Resolver @IDUsuario = @IDUsuario, @TokenInvitado = NULL, @Crear = 1, @IDCarrito = @IDCarrito OUTPUT;
    EXEC dbo.SP_Cupones_Validar @IDUsuario = @IDUsuario, @IDCarrito = @IDCarrito, @Codigo = @Codigo, @IDCupon = @IDCupon OUTPUT;

    BEGIN TRANSACTION;
    UPDATE dbo.Reservas SET Estado = N'Anulada' WHERE IDCarrito = @IDCarrito AND Estado = N'Activa';
    UPDATE dbo.Carritos SET IDCupon = @IDCupon, FechaActualizacion = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;
    COMMIT TRANSACTION;

    EXEC dbo.SP_Carrito_Consultar @IDCarrito = @IDCarrito;
END;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Carrito_QuitarCupon
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDCarrito INT;
    EXEC dbo.SP_Carrito_Resolver @IDUsuario = @IDUsuario, @TokenInvitado = NULL, @Crear = 1, @IDCarrito = @IDCarrito OUTPUT;

    BEGIN TRANSACTION;
    UPDATE dbo.Reservas SET Estado = N'Anulada' WHERE IDCarrito = @IDCarrito AND Estado = N'Activa';
    UPDATE dbo.Carritos SET IDCupon = NULL, FechaActualizacion = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;
    COMMIT TRANSACTION;

    EXEC dbo.SP_Carrito_Consultar @IDCarrito = @IDCarrito;
END;
GO

-- Al iniciar sesión, el carrito del invitado pasa al del usuario. Si ambos tienen la
-- misma variante se suman cantidades, limitadas al disponible. El carrito del
-- invitado queda Fusionado.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Fusionar
    @IDUsuario     INT,
    @TokenInvitado UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDInvitado INT = (SELECT IDCarrito FROM dbo.Carritos
                               WHERE TokenInvitado = @TokenInvitado AND IDUsuario IS NULL AND Estado = N'Abierto');
    DECLARE @IDCarrito INT;

    BEGIN TRY
        BEGIN TRANSACTION;
        EXEC dbo.SP_Carrito_Resolver @IDUsuario = @IDUsuario, @TokenInvitado = NULL, @Crear = 1, @IDCarrito = @IDCarrito OUTPUT;

        IF @IDInvitado IS NOT NULL
        BEGIN
            DECLARE @Lineas TABLE (IDVariante INT PRIMARY KEY, Cantidad INT);
            INSERT INTO @Lineas SELECT IDVariante, Cantidad FROM dbo.CarritoDetalle WHERE IDCarrito = @IDInvitado;

            DECLARE @IDVariante INT = 0, @Cantidad INT, @Actual INT, @Disponible INT;
            WHILE 1 = 1
            BEGIN
                SELECT TOP (1) @IDVariante = IDVariante, @Cantidad = Cantidad
                FROM @Lineas WHERE IDVariante > @IDVariante ORDER BY IDVariante;
                IF @@ROWCOUNT = 0 BREAK;

                SET @Actual = ISNULL((SELECT Cantidad FROM dbo.CarritoDetalle
                                      WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante), 0);
                SET @Disponible = ISNULL((SELECT Disponible FROM dbo.FU_Inventario_Disponibilidad()
                                          WHERE IDVariante = @IDVariante), 0);
                SET @Cantidad = CASE WHEN @Actual + @Cantidad > @Disponible THEN @Disponible ELSE @Actual + @Cantidad END;

                IF @Cantidad > 0 AND @Cantidad <> @Actual
                BEGIN
                    IF @Actual = 0
                        INSERT INTO dbo.CarritoDetalle (IDCarrito, IDVariante, Cantidad) VALUES (@IDCarrito, @IDVariante, @Cantidad);
                    ELSE
                        UPDATE dbo.CarritoDetalle SET Cantidad = @Cantidad WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;
                END;
            END;

            DELETE FROM dbo.CarritoDetalle WHERE IDCarrito = @IDInvitado;
            UPDATE dbo.Carritos SET Estado = N'Fusionado', FechaActualizacion = SYSUTCDATETIME() WHERE IDCarrito = @IDInvitado;
            UPDATE dbo.Reservas SET Estado = N'Anulada' WHERE IDCarrito = @IDCarrito AND Estado = N'Activa';
            UPDATE dbo.Carritos SET FechaActualizacion = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;
        END;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC dbo.SP_Carrito_Consultar @IDCarrito = @IDCarrito;
END;
GO
