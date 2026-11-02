-- Datos SINTÉTICOS para la prueba de restauración. Ningún dato real.
-- Se aplica después de las migraciones de Payload (si existen) e incluye un esquema propio
-- con tipos variados (jsonb, bytea, enum, FK, secuencias) para que la prueba no dependa del CMS.
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    INSERT INTO public.users (name, email, role, salt, hash)
      SELECT 'Usuario de prueba ' || g, 'prueba' || g || '@example.invalid', 'admin', md5(g::text), md5('h' || g)
      FROM generate_series(1, 25) g;
    INSERT INTO public.users_sessions (_order, _parent_id, id, created_at, expires_at)
      SELECT 1, u.id, md5('s' || u.id), now(), now() + interval '1 day' FROM public.users u;
    INSERT INTO public.media (alt, credit, filename, mime_type, filesize, width, height)
      SELECT 'Imagen ' || g, 'Crédito ' || g, 'imagen-' || g || '.webp', 'image/webp', 1000 + g, 1600, 900
      FROM generate_series(1, 120) g;
    INSERT INTO public.payload_preferences (key, value)
      SELECT 'pref-' || g, jsonb_build_object('n', g) FROM generate_series(1, 30) g;
    INSERT INTO public.payload_preferences_rels ("order", parent_id, path, users_id)
      SELECT 1, p.id, 'user', (SELECT min(id) FROM public.users) FROM public.payload_preferences p;
    INSERT INTO public.payload_kv (key, data)
      SELECT 'kv-' || g, jsonb_build_object('valor', g) FROM generate_series(1, 7) g;
  END IF;
END $$;

CREATE SCHEMA restore_test;
CREATE TYPE restore_test.estado AS ENUM ('borrador', 'publicado', 'archivado');
CREATE TABLE restore_test.concejos (
  id serial PRIMARY KEY,
  nombre text NOT NULL UNIQUE
);
CREATE TABLE restore_test.noticias (
  id bigserial PRIMARY KEY,
  concejo_id int NOT NULL REFERENCES restore_test.concejos(id),
  titulo text NOT NULL,
  estado restore_test.estado NOT NULL,
  datos jsonb NOT NULL,
  miniatura bytea,
  publicada_en timestamptz
);
INSERT INTO restore_test.concejos (nombre)
  SELECT 'Concejo ' || g FROM generate_series(1, 12) g;
INSERT INTO restore_test.noticias (concejo_id, titulo, estado, datos, miniatura, publicada_en)
  SELECT 1 + (g % 12), 'Noticia ' || g, (ARRAY['borrador','publicado','archivado']::restore_test.estado[])[1 + g % 3],
         jsonb_build_object('palabras', g * 7, 'etiquetas', jsonb_build_array('a', g)),
         decode(md5(g::text), 'hex'), now() - (g || ' minutes')::interval
  FROM generate_series(1, 20000) g;
CREATE TABLE restore_test.vacia (id int PRIMARY KEY);
