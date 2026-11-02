-- Reseñas con lo que se puede mostrar en público. Autor es el nombre y la inicial del
-- apellido; si el nombre registrado es un correo se muestra "Cliente". Nunca sale el
-- correo ni el id del usuario.
CREATE OR ALTER FUNCTION dbo.FU_Resenas_Publicas ()
RETURNS TABLE
AS
RETURN (
    SELECT r.IDResena, r.IDProducto, r.Calificacion, r.Comentario, r.Fecha,
           CASE WHEN CHARINDEX(N'@', n.Nombre) > 0 THEN N'Cliente'
                WHEN e.Espacio = 0 THEN n.Nombre
                ELSE LEFT(n.Nombre, e.Espacio - 1) + N' ' + UPPER(LEFT(LTRIM(SUBSTRING(n.Nombre, e.Espacio, 100)), 1)) + N'.'
           END AS Autor
    FROM dbo.Resenas r
    JOIN dbo.Usuarios u ON u.IDUsuario = r.IDUsuario
    CROSS APPLY (SELECT LTRIM(RTRIM(u.Nombre)) AS Nombre) n
    CROSS APPLY (SELECT CHARINDEX(N' ', n.Nombre) AS Espacio) e
);
GO
