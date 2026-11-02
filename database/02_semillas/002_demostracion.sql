-- Datos de demostración para que el dashboard no salga vacío: direcciones de los
-- clientes de prueba, 14 pedidos de los últimos 75 días en todos los estados (con
-- devoluciones y una cancelación) y 3 carritos abandonados.
--
-- Los pedidos se escriben directamente con fechas pasadas, porque los SP usan la fecha
-- actual. Se siguen las mismas reglas que los SP:
--   * cada pedido tiene su carrito Convertido, su reserva Consumida y sus líneas;
--   * el historial recorre las transiciones de PedidoTransiciones;
--   * todo pedido despachado tiene su fila de PedidoEnvios, con las fechas del historial;
--   * toda salida, cancelación o devolución cambia Variantes.Existencia y escribe su
--     fila de kardex, así la existencia sigue igual a la suma del kardex (se comprueba al final).
-- Ningún pedido es de hoy ni de ayer, para no mezclarse con las pruebas del dashboard.

------------------------------------------------------------
-- Direcciones de los clientes de prueba
------------------------------------------------------------
INSERT INTO dbo.Direcciones (IDUsuario, Direccion, Ciudad, Telefono)
SELECT u.IDUsuario, d.Direccion, d.Ciudad, d.Telefono
FROM (VALUES
    (N'cliente@shopcart.test',  N'6a avenida 12-34 zona 1', N'Guatemala', N'55551234'),
    (N'cliente@shopcart.test',  N'Calzada Roosevelt 22-43 zona 11', N'Guatemala', N'55551234'),
    (N'cliente2@shopcart.test', N'4a calle 5-67 zona 3', N'Quetzaltenango', N'44449876')
) AS d (Correo, Direccion, Ciudad, Telefono)
JOIN dbo.Usuarios u ON u.Correo = d.Correo;
GO

------------------------------------------------------------
-- Pedidos de demostración
------------------------------------------------------------
DECLARE @Pedidos TABLE (Num INT PRIMARY KEY, Correo NVARCHAR(150), DiasAtras INT, Estado NVARCHAR(20));
INSERT INTO @Pedidos (Num, Correo, DiasAtras, Estado) VALUES
    (1,  N'cliente@shopcart.test',  75, N'Entregado'),
    (2,  N'cliente2@shopcart.test', 68, N'Entregado'),
    (3,  N'cliente@shopcart.test',  60, N'DevueltoParcial'),
    (4,  N'cliente2@shopcart.test', 52, N'Entregado'),
    (5,  N'cliente@shopcart.test',  45, N'Devuelto'),
    (6,  N'cliente2@shopcart.test', 38, N'Entregado'),
    (7,  N'cliente@shopcart.test',  30, N'Cancelado'),
    (8,  N'cliente2@shopcart.test', 24, N'Entregado'),
    (9,  N'cliente@shopcart.test',  18, N'Entregado'),
    (10, N'cliente2@shopcart.test', 12, N'DevueltoParcial'),
    (11, N'cliente@shopcart.test',   8, N'Entregado'),
    (12, N'cliente2@shopcart.test',  5, N'Despachado'),
    (13, N'cliente@shopcart.test',   4, N'EnPreparacion'),
    (14, N'cliente2@shopcart.test',  2, N'Pagado');

-- Devuelta: unidades devueltas de la línea (todas en Devuelto, parte en DevueltoParcial).
DECLARE @Lineas TABLE (Num INT, SKU NVARCHAR(40), Cantidad INT, Devuelta INT, PRIMARY KEY (Num, SKU));
INSERT INTO @Lineas (Num, SKU, Cantidad, Devuelta) VALUES
    (1,  N'ELE-AUD-NEG', 1, 0), (1,  N'COM-MOU-001', 2, 0),
    (2,  N'COM-LAP-256', 1, 0),
    (3,  N'ROP-PLA-M',   3, 1), (3,  N'ROP-GOR-001', 1, 0),
    (4,  N'COC-LIC-001', 1, 0), (4,  N'COC-SAR-24',  2, 0),
    (5,  N'CAL-TEN-42',  1, 1),
    (6,  N'DEP-TAP-001', 2, 0), (6,  N'DEP-BOT-750', 3, 0),
    (7,  N'ELE-TV-43',   1, 0),
    (8,  N'HOG-SAB-MAT', 1, 0), (8,  N'HOG-ALM-001', 2, 0),
    (9,  N'JUG-BLO-500', 1, 0), (9,  N'JUG-MES-001', 1, 0),
    (10, N'COM-USB-128', 4, 2),
    (11, N'ELE-BAT-10K', 2, 0), (11, N'COM-TEC-001', 1, 0),
    (12, N'COC-CAF-012', 1, 0),
    (13, N'ROP-PAN-32',  1, 0),
    (14, N'ELE-CAR-20W', 2, 0);

-- Días después de la compra en que el pedido llega a cada estado.
DECLARE @Pasos TABLE (Dias INT, EstadoAnterior NVARCHAR(20), EstadoNuevo NVARCHAR(20));
INSERT INTO @Pasos (Dias, EstadoAnterior, EstadoNuevo) VALUES
    (1, N'Pagado', N'EnPreparacion'),
    (2, N'EnPreparacion', N'Despachado'),
    (3, N'Despachado', N'Entregado');

DECLARE @Operador INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'operador@shopcart.test');
DECLARE @L TABLE (IDVariante INT PRIMARY KEY, Cantidad INT, Devuelta INT, Precio DECIMAL(12,2));
DECLARE @Num INT = 0, @Correo NVARCHAR(150), @DiasAtras INT, @Estado NVARCHAR(20), @OrdenFinal INT,
        @IDUsuario INT, @IDDireccion INT, @Fecha DATETIME2(0), @FechaFinal DATETIME2(0),
        @IDCarrito INT, @IDReserva INT, @IDPedido INT, @IDDevolucion INT, @Subtotal DECIMAL(12,2);

WHILE 1 = 1
BEGIN
    SELECT TOP (1) @Num = Num, @Correo = Correo, @DiasAtras = DiasAtras, @Estado = Estado
    FROM @Pedidos WHERE Num > @Num ORDER BY Num;
    IF @@ROWCOUNT = 0 BREAK;

    SET @IDUsuario = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = @Correo);
    SET @IDDireccion = (SELECT MIN(IDDireccion) FROM dbo.Direcciones WHERE IDUsuario = @IDUsuario);
    -- Entre las 14:00 y las 19:00 UTC (8:00 a 13:00 en Guatemala).
    SET @Fecha = DATEADD(HOUR, 14 + @Num % 6, CAST(DATEADD(DAY, -@DiasAtras, CAST(SYSUTCDATETIME() AS DATE)) AS DATETIME2(0)));
    SET @OrdenFinal = (SELECT Orden FROM dbo.PedidoEstados WHERE Estado = @Estado);
    SET @FechaFinal = DATEADD(DAY, CASE @Estado WHEN N'Pagado' THEN 0 WHEN N'EnPreparacion' THEN 1 WHEN N'Despachado' THEN 2
                                               WHEN N'Entregado' THEN 3 WHEN N'Cancelado' THEN 1 ELSE 5 END, @Fecha);

    DELETE FROM @L;
    INSERT INTO @L (IDVariante, Cantidad, Devuelta, Precio)
    SELECT v.IDVariante, l.Cantidad, l.Devuelta, v.Precio
    FROM @Lineas l JOIN dbo.Variantes v ON v.SKU = l.SKU
    WHERE l.Num = @Num;
    SET @Subtotal = (SELECT SUM(Cantidad * Precio) FROM @L);

    -- Los cambios de existencia de la venta quedan en la bitácora a nombre del cliente.
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

    INSERT INTO dbo.Carritos (IDUsuario, Estado, FechaCreacion, FechaActualizacion)
    VALUES (@IDUsuario, N'Convertido', DATEADD(MINUTE, -20, @Fecha), @Fecha);
    SET @IDCarrito = SCOPE_IDENTITY();

    INSERT INTO dbo.Reservas (IDUsuario, IDCarrito, Estado, Expira, Subtotal, Descuento, Total,
                              IDDireccion, Direccion, Ciudad, Telefono, FechaCreacion)
    SELECT @IDUsuario, @IDCarrito, N'Consumida', DATEADD(MINUTE, 15, @Fecha), @Subtotal, 0, @Subtotal,
           d.IDDireccion, d.Direccion, d.Ciudad, d.Telefono, DATEADD(MINUTE, -2, @Fecha)
    FROM dbo.Direcciones d WHERE d.IDDireccion = @IDDireccion;
    SET @IDReserva = SCOPE_IDENTITY();

    INSERT INTO dbo.ReservaDetalle (IDReserva, IDVariante, Cantidad, PrecioUnitario, Descuento)
    SELECT @IDReserva, IDVariante, Cantidad, Precio, 0 FROM @L;

    INSERT INTO dbo.Pedidos (IDUsuario, IDReserva, Estado, Subtotal, Descuento, Total, IVA,
                             IDDireccion, Direccion, Ciudad, Telefono, ReferenciaPago, FechaCreacion, FechaActualizacion)
    SELECT @IDUsuario, @IDReserva, @Estado, @Subtotal, 0, @Subtotal, ROUND(@Subtotal - @Subtotal / 1.12, 2),
           d.IDDireccion, d.Direccion, d.Ciudad, d.Telefono, N'SIM-' + CONVERT(NVARCHAR(36), NEWID()), @Fecha, @FechaFinal
    FROM dbo.Direcciones d WHERE d.IDDireccion = @IDDireccion;
    SET @IDPedido = SCOPE_IDENTITY();

    INSERT INTO dbo.PedidoDetalle (IDPedido, IDVariante, Cantidad, PrecioUnitario, Descuento, CantidadDevuelta)
    SELECT @IDPedido, IDVariante, Cantidad, Precio, 0, Devuelta FROM @L;

    -- Historial: creación y luego cada transición hasta el estado final.
    INSERT INTO dbo.PedidoHistorial (IDPedido, EstadoAnterior, EstadoNuevo, IDUsuario, Comentario, Fecha)
    VALUES (@IDPedido, NULL, N'Pagado', @IDUsuario, N'Pedido creado', @Fecha);

    IF @Estado = N'Cancelado'
        INSERT INTO dbo.PedidoHistorial (IDPedido, EstadoAnterior, EstadoNuevo, IDUsuario, Comentario, Fecha)
        VALUES (@IDPedido, N'Pagado', N'Cancelado', @IDUsuario, N'Cancelado por el cliente', @FechaFinal);
    ELSE
    BEGIN
        INSERT INTO dbo.PedidoHistorial (IDPedido, EstadoAnterior, EstadoNuevo, IDUsuario, Comentario, Fecha)
        SELECT @IDPedido, p.EstadoAnterior, p.EstadoNuevo, @Operador, NULL, DATEADD(DAY, p.Dias, @Fecha)
        FROM @Pasos p JOIN dbo.PedidoEstados e ON e.Estado = p.EstadoNuevo
        WHERE e.Orden <= @OrdenFinal
        ORDER BY p.Dias;

        IF @Estado IN (N'DevueltoParcial', N'Devuelto')
            INSERT INTO dbo.PedidoHistorial (IDPedido, EstadoAnterior, EstadoNuevo, IDUsuario, Comentario, Fecha)
            VALUES (@IDPedido, N'Entregado', @Estado, @Operador, N'Producto defectuoso', @FechaFinal);
    END;

    -- Envío: desde Despachado en adelante, con las fechas del historial (@Pasos).
    IF @Estado IN (N'Despachado', N'Entregado', N'DevueltoParcial', N'Devuelto')
        INSERT INTO dbo.PedidoEnvios (IDPedido, Mensajeria, Guia, PesoKg, CostoRecogida, RecibidoPor, FechaDespacho, FechaEntrega)
        SELECT @IDPedido,
               CASE @Num % 3 WHEN 0 THEN N'Mensajería Central' WHEN 1 THEN N'Reparto Rápido' ELSE N'Entrega Segura' END,
               N'GUIA-' + RIGHT(N'0000' + CAST(@Num AS NVARCHAR(4)), 4),
               0.50 + 0.25 * @Num,
               20 + 5 * (@Num % 3),
               CASE WHEN @Estado <> N'Despachado' THEN u.Nombre END,
               DATEADD(DAY, 2, @Fecha),
               CASE WHEN @Estado <> N'Despachado' THEN DATEADD(DAY, 3, @Fecha) END
        FROM dbo.Usuarios u WHERE u.IDUsuario = @IDUsuario;

    -- Salida de kardex por la venta. Las variantes de un pedido no se repiten, así que
    -- se actualizan todas juntas y el kardex lee la existencia ya actualizada.
    UPDATE v SET Existencia = v.Existencia - l.Cantidad
    FROM dbo.Variantes v JOIN @L l ON l.IDVariante = v.IDVariante;
    INSERT INTO dbo.Kardex (IDVariante, Tipo, Cantidad, ExistenciaResultante, Motivo, IDUsuario, IDPedido, Fecha)
    SELECT l.IDVariante, N'Salida', -l.Cantidad, v.Existencia, N'Venta, pedido #' + CAST(@IDPedido AS NVARCHAR(10)),
           @IDUsuario, @IDPedido, @Fecha
    FROM @L l JOIN dbo.Variantes v ON v.IDVariante = l.IDVariante;

    -- Cancelación: se reintegra todo por kardex.
    IF @Estado = N'Cancelado'
    BEGIN
        UPDATE v SET Existencia = v.Existencia + l.Cantidad
        FROM dbo.Variantes v JOIN @L l ON l.IDVariante = v.IDVariante;
        INSERT INTO dbo.Kardex (IDVariante, Tipo, Cantidad, ExistenciaResultante, Motivo, IDUsuario, IDPedido, Fecha)
        SELECT l.IDVariante, N'Devolucion', l.Cantidad, v.Existencia, N'Cancelación, pedido #' + CAST(@IDPedido AS NVARCHAR(10)),
               @IDUsuario, @IDPedido, @FechaFinal
        FROM @L l JOIN dbo.Variantes v ON v.IDVariante = l.IDVariante;
    END;

    -- Devolución registrada por el Operador: encabezado, líneas y reintegro por kardex.
    IF EXISTS (SELECT 1 FROM @L WHERE Devuelta > 0)
    BEGIN
        EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @Operador;

        INSERT INTO dbo.Devoluciones (IDPedido, IDUsuario, Motivo, Monto, Fecha)
        SELECT @IDPedido, @Operador, N'Producto defectuoso', SUM(Devuelta * Precio), @FechaFinal
        FROM @L WHERE Devuelta > 0;
        SET @IDDevolucion = SCOPE_IDENTITY();

        INSERT INTO dbo.DevolucionDetalle (IDDevolucion, IDPedidoDetalle, Cantidad, Monto)
        SELECT @IDDevolucion, pd.IDPedidoDetalle, l.Devuelta, l.Devuelta * l.Precio
        FROM @L l JOIN dbo.PedidoDetalle pd ON pd.IDPedido = @IDPedido AND pd.IDVariante = l.IDVariante
        WHERE l.Devuelta > 0;

        UPDATE v SET Existencia = v.Existencia + l.Devuelta
        FROM dbo.Variantes v JOIN @L l ON l.IDVariante = v.IDVariante
        WHERE l.Devuelta > 0;
        INSERT INTO dbo.Kardex (IDVariante, Tipo, Cantidad, ExistenciaResultante, Motivo, IDUsuario, IDPedido, Fecha)
        SELECT l.IDVariante, N'Devolucion', l.Devuelta, v.Existencia,
               N'Devolución #' + CAST(@IDDevolucion AS NVARCHAR(10)) + N', pedido #' + CAST(@IDPedido AS NVARCHAR(10)),
               @Operador, @IDPedido, @FechaFinal
        FROM @L l JOIN dbo.Variantes v ON v.IDVariante = l.IDVariante
        WHERE l.Devuelta > 0;
    END;
END;

EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = NULL;
GO

------------------------------------------------------------
-- Carritos abandonados: abiertos, con productos y sin cambios hace más de 24 horas
------------------------------------------------------------
DECLARE @Carritos TABLE (Num INT PRIMARY KEY, Correo NVARCHAR(150) NULL, HorasAtras INT);
INSERT INTO @Carritos (Num, Correo, HorasAtras) VALUES
    (1, N'cliente2@shopcart.test', 72),   -- de un cliente con cuenta
    (2, NULL, 48),                        -- de invitados (por token)
    (3, NULL, 30);

DECLARE @Contenido TABLE (Num INT, SKU NVARCHAR(40), Cantidad INT);
INSERT INTO @Contenido (Num, SKU, Cantidad) VALUES
    (1, N'ELE-REL-NEG', 1), (1, N'ROP-SUE-M', 1),
    (2, N'JUG-CAR-001', 1),
    (3, N'HOG-LAM-001', 2), (3, N'HOG-COR-GRI', 1);

DECLARE @Num INT = 0, @Correo NVARCHAR(150), @Horas INT, @Fecha DATETIME2(0), @IDCarrito INT;
WHILE 1 = 1
BEGIN
    SELECT TOP (1) @Num = Num, @Correo = Correo, @Horas = HorasAtras FROM @Carritos WHERE Num > @Num ORDER BY Num;
    IF @@ROWCOUNT = 0 BREAK;

    SET @Fecha = DATEADD(HOUR, -@Horas, SYSUTCDATETIME());
    INSERT INTO dbo.Carritos (IDUsuario, TokenInvitado, Estado, FechaCreacion, FechaActualizacion)
    VALUES ((SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = @Correo),
            CASE WHEN @Correo IS NULL THEN NEWID() END, N'Abierto', DATEADD(MINUTE, -30, @Fecha), @Fecha);
    SET @IDCarrito = SCOPE_IDENTITY();

    INSERT INTO dbo.CarritoDetalle (IDCarrito, IDVariante, Cantidad)
    SELECT @IDCarrito, v.IDVariante, c.Cantidad
    FROM @Contenido c JOIN dbo.Variantes v ON v.SKU = c.SKU
    WHERE c.Num = @Num;
END;
GO

------------------------------------------------------------
-- Comprobación: la existencia de cada variante es igual a la suma de su kardex
------------------------------------------------------------
IF EXISTS (
    SELECT 1 FROM dbo.Variantes v
    WHERE v.Existencia <> ISNULL((SELECT SUM(k.Cantidad) FROM dbo.Kardex k WHERE k.IDVariante = v.IDVariante), 0))
    THROW 50000, N'Las semillas de demostración dejaron una existencia distinta de la suma del kardex.', 1;
GO

------------------------------------------------------------
-- Comprobación: todo pedido desde Despachado tiene envío, y solo los entregados tienen receptor
------------------------------------------------------------
IF EXISTS (
    SELECT 1 FROM dbo.Pedidos p
    LEFT JOIN dbo.PedidoEnvios e ON e.IDPedido = p.IDPedido
    WHERE (p.Estado IN (N'Despachado', N'Entregado', N'DevueltoParcial', N'Devuelto') AND e.IDPedido IS NULL)
       OR (p.Estado NOT IN (N'Despachado', N'Entregado', N'DevueltoParcial', N'Devuelto') AND e.IDPedido IS NOT NULL)
       OR (p.Estado = N'Despachado' AND e.RecibidoPor IS NOT NULL)
       OR (p.Estado IN (N'Entregado', N'DevueltoParcial', N'Devuelto') AND (e.RecibidoPor IS NULL OR e.FechaEntrega IS NULL)))
    THROW 50000, N'Las semillas de demostración dejaron un pedido sin envío coherente.', 1;
GO
