-- Propiedad y permisos de la base ACTUAL (idempotente). Se ejecuta como superusuario en cada base:
-- inicialización, bases existentes y bases restauradas.
\set ON_ERROR_STOP on
\getenv migrator POSTGRES_MIGRATOR_USER
\getenv app POSTGRES_APP_USER
SELECT :'migrator' ~ '^[a-z_][a-z0-9_]{0,62}$' AND :'app' ~ '^[a-z_][a-z0-9_]{0,62}$'
   AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migrator') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app') AS valid \gset
\if :valid
\else
  DO $$ BEGIN RAISE EXCEPTION 'Faltan los usuarios de migraciones/aplicación: ejecuta antes infra/postgres/roles.sql'; END $$;
\endif

-- Base: nadie más se conecta; solo el migrador crea esquemas y tablas temporales.
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database()) \gexec
SELECT format('GRANT CONNECT, CREATE, TEMPORARY ON DATABASE %I TO %I', current_database(), :'migrator') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM %I', current_database(), :'app') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app') \gexec

-- Esquema public: propiedad del migrador; la aplicación solo puede usarlo, no crear objetos.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SELECT format('ALTER SCHEMA public OWNER TO %I', :'migrator') \gexec
SELECT format('REVOKE ALL ON SCHEMA public FROM %I', :'app') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app') \gexec

-- Objetos existentes (bases creadas antes de separar usuarios): pasan al migrador.
SELECT format('ALTER TABLE %I.%I OWNER TO %I', n.nspname, c.relname, :'migrator')
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f') AND pg_get_userbyid(c.relowner) <> :'migrator' \gexec
SELECT format('ALTER SEQUENCE %I.%I OWNER TO %I', n.nspname, c.relname, :'migrator')
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'S' AND pg_get_userbyid(c.relowner) <> :'migrator'
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype IN ('a', 'i')) \gexec
SELECT format('ALTER TYPE %I.%I OWNER TO %I', n.nspname, t.typname, :'migrator')
  FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
 WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd') AND pg_get_userbyid(t.typowner) <> :'migrator' \gexec
SELECT format('ALTER ROUTINE %s OWNER TO %I', p.oid::regprocedure, :'migrator')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND pg_get_userbyid(p.proowner) <> :'migrator'
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') \gexec

-- Aplicación: solo datos. Sin TRUNCATE, REFERENCES, TRIGGER ni DDL.
SELECT format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', :'app') \gexec
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', :'app') \gexec
SELECT format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO %I', :'app') \gexec
-- Tablas y secuencias que cree el migrador en el futuro.
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', :'migrator', :'app') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I', :'migrator', :'app') \gexec
