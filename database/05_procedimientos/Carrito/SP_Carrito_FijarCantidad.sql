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
