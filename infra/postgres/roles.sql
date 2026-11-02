-- Usuarios de PostgreSQL de Planta 14 (idempotente). Se ejecuta como superusuario.
--   POSTGRES_MIGRATOR_USER: aplica las migraciones; es propietario del esquema public y de sus objetos.
--   POSTGRES_APP_USER:      usado por la aplicación; solo lee y escribe datos (sin DDL).
-- Nombres y contraseñas se leen del entorno (\getenv), no de la línea de órdenes.
\set ON_ERROR_STOP on
\getenv migrator POSTGRES_MIGRATOR_USER
\getenv migrator_password POSTGRES_MIGRATOR_PASSWORD
\getenv app POSTGRES_APP_USER
\getenv app_password POSTGRES_APP_PASSWORD

SELECT :'migrator' ~ '^[a-z_][a-z0-9_]{0,62}$' AND :'app' ~ '^[a-z_][a-z0-9_]{0,62}$' AND :'migrator' <> :'app'
   AND length(:'migrator_password') >= 16 AND length(:'app_password') >= 16 AS valid \gset
\if :valid
\else
  DO $$ BEGIN RAISE EXCEPTION 'POSTGRES_MIGRATOR_USER y POSTGRES_APP_USER deben ser identificadores distintos y sus contraseñas tener 16+ caracteres'; END $$;
\endif

SELECT format('CREATE ROLE %I', :'migrator') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migrator') \gexec
SELECT format('CREATE ROLE %I', :'app') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT CONNECTION LIMIT 5 PASSWORD %L', :'migrator', :'migrator_password') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 40 PASSWORD %L', :'app', :'app_password') \gexec
