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
