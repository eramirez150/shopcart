-- Permisos del usuario de la aplicación: solo EXECUTE sobre los SP.
-- No recibe SELECT, INSERT, UPDATE ni DELETE sobre las tablas. Los SP, las
-- vistas y las funciones usan las tablas por encadenamiento de propiedad (mismo dueño).
--
-- El usuario se crea sin inicio de sesión para no guardar contraseñas en el
-- repositorio. Para conectar la API se crea el inicio de sesión con la clave
-- del entorno y se asocia (ver README):
--   CREATE LOGIN shopcart_app WITH PASSWORD = '<clave>';
--   ALTER USER shopcart_app WITH LOGIN = shopcart_app;
IF DATABASE_PRINCIPAL_ID(N'RolShopCartApp') IS NULL
    CREATE ROLE RolShopCartApp;
GO

IF DATABASE_PRINCIPAL_ID(N'shopcart_app') IS NULL
    CREATE USER shopcart_app WITHOUT LOGIN;
GO

ALTER ROLE RolShopCartApp ADD MEMBER shopcart_app;
GRANT EXECUTE ON SCHEMA::dbo TO RolShopCartApp;
GO
