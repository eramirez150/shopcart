-- Permisos de la aplicación: solo EXECUTE sobre los stored procedures.
-- El rol no recibe SELECT, INSERT, UPDATE ni DELETE sobre las tablas. Los SP, las
-- vistas y las funciones leen y escriben las tablas por encadenamiento de
-- propiedad (todos pertenecen a dbo).
--
-- El inicio de sesión lleva contraseña y no se guarda en el repositorio. Después
-- de aplicar los scripts se crea con la clave del entorno y se agrega al rol (ver README):
--   CREATE LOGIN shopcart_app WITH PASSWORD = '<clave>';
--   CREATE USER shopcart_app FOR LOGIN shopcart_app;
--   ALTER ROLE RolShopCartApp ADD MEMBER shopcart_app;
IF DATABASE_PRINCIPAL_ID(N'RolShopCartApp') IS NULL
    CREATE ROLE RolShopCartApp;
GO

GRANT EXECUTE ON SCHEMA::dbo TO RolShopCartApp;
GO
