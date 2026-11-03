import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import { randomBytes } from 'node:crypto'

// Identidad visual de cada espacio municipal (foto de cabecera, lema, escudo, colores y enlaces), editable en el CMS.
// Además de crear los campos, carga en los espacios EXISTENTES de los seis concejos del Caudal los valores que la web
// tenía en lib/demo (congelados aquí), para que tras desplegar se vea igual. No sobrescribe nada que ya tenga valor.
// down: borra los campos (la web vuelve a no tener identidad en los espacios de payload).
const seed: Record<string, {
  heroImagePath: string; heroImageAlt: string; heroImageCredit: string; heroImageSource: string; heroImageLicenseUrl: string;
  title: string; subtitle: string; crestPath: string; crestCredit: string; crestSource: string; crestLicenseUrl: string;
  colors: { accent: string; dark: string; soft: string; border: string }; official: string; tourism: string;
  stories: { label: string; title: string; text: string; href: string }[];
}> = {
  "aller": {
    "heroImagePath": "/aller/panorama.webp",
    "heroImageAlt": "Panorámica de la cabecera del río Las Mestas, en Santibáñez de Murias, Aller",
    "heroImageCredit": "Santibáñez de Murias · LBM1948 · CC BY-SA 4.0 · Archivo de 2006",
    "heroImageSource": "https://commons.wikimedia.org/wiki/File:Asturias,_panorámicas_(2006)_03.jpg",
    "heroImageLicenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
    "title": "Aller, cerca de ti.",
    "subtitle": "La vida de nuestros pueblos. La fuerza de nuestras montañas.",
    "crestPath": "/aller/escudo.svg",
    "crestCredit": "SanchoPanzaXXI · CC BY-SA 4.0",
    "crestSource": "https://commons.wikimedia.org/wiki/File:Escudo_de_Aller.svg",
    "crestLicenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
    "colors": {
      "accent": "#315c49",
      "dark": "#243d32",
      "soft": "#edf0e6",
      "border": "#d3ddc9"
    },
    "official": "https://www.aller.es/",
    "tourism": "https://visitaaller.es/",
    "stories": [
      {
        "label": "Nieve y montaña",
        "title": "Fuentes de Invierno",
        "text": "El invierno tiene un lugar propio en Aller. Descubre la estación y su entorno de montaña.",
        "href": "/noticia/fuentes-invierno-actividad-todo-el-ano"
      },
      {
        "label": "Coto Bello",
        "title": "Un concejo para mirar al cielo",
        "text": "Aller Estelar acerca la astronomía al mirador de Coto Bello. Una experiencia organizada por Jarascada.",
        "href": "https://www.turismoasturias.es/es/-/blogs/astroturismo-en-asturias-donde-ver-las-estrellas"
      },
      {
        "label": "Paisaje y caminos",
        "title": "El agua dibuja el camino",
        "text": "La cascada de Xurbeo y las Foces de El Pino invitan a descubrir la naturaleza del concejo.",
        "href": "https://visitaaller.es/naturaleza-imprescindible"
      }
    ]
  },
  "lena": {
    "heroImagePath": "/lena/panorama.webp",
    "heroImageAlt": "Iglesia de Santa Cristina de Lena entre prados y árboles",
    "heroImageCredit": "Santa Cristina de Lena · Jose Luis Martinez Alvarez · CC BY-SA 2.0 · Archivo",
    "heroImageSource": "https://commons.wikimedia.org/wiki/File:Santa_Cristina_de_Lena.jpg",
    "heroImageLicenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "title": "Lena, un lugar para quedarse.",
    "subtitle": "Patrimonio que emociona. Montañas que abren caminos.",
    "crestPath": "/lena/escudo.svg",
    "crestCredit": "Manuelfb55 · CC BY-SA 4.0",
    "crestSource": "https://commons.wikimedia.org/wiki/File:Escudo_de_Lena.svg",
    "crestLicenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "colors": {
      "accent": "#456477",
      "dark": "#263e4d",
      "soft": "#e7eef1",
      "border": "#c9d7df"
    },
    "official": "https://www.aytolena.es/",
    "tourism": "https://www.aytolena.es/web-turismo",
    "stories": [
      {
        "label": "Patrimonio",
        "title": "Santa Cristina de Lena",
        "text": "Una joya del prerrománico que conecta el paisaje con la historia.",
        "href": "https://www.aytolena.es/santa-cristina"
      },
      {
        "label": "Nieve y montaña",
        "title": "Valgrande-Pajares",
        "text": "La montaña lenense invita a disfrutar del concejo en distintas estaciones.",
        "href": "https://www.valgrande-pajares.com/turismo/"
      },
      {
        "label": "Pueblos y caminos",
        "title": "Descubrir Lena a otro ritmo",
        "text": "Pueblos, valles y caminos para acercarse a la vida del concejo.",
        "href": "https://www.turismoasturias.es/descubre/donde-ir/municipios/lena"
      }
    ]
  },
  "mieres": {
    "heroImagePath": "/mieres/panorama.webp",
    "heroImageAlt": "Río Caudal y entorno urbano de Mieres",
    "heroImageCredit": "El Caudal a su paso por Mieres · José Antonio Gil Martínez from Vigo, Spain · CC BY 2.0 · Archivo",
    "heroImageSource": "https://commons.wikimedia.org/wiki/File:Mieres_(1422888016).jpg",
    "heroImageLicenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "title": "Mieres, historia que se mueve.",
    "subtitle": "Vida en las plazas. Memoria en los valles. Mirada al futuro.",
    "crestPath": "/mieres/escudo.svg",
    "crestCredit": "SanchoPanzaXXI · CC BY-SA 4.0",
    "crestSource": "https://commons.wikimedia.org/wiki/File:Escudo_de_Mieres.svg",
    "crestLicenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "colors": {
      "accent": "#7e4b3e",
      "dark": "#49332e",
      "soft": "#f1e8e2",
      "border": "#dfccc3"
    },
    "official": "https://www.mieres.es/",
    "tourism": "https://www.mieres.es/turismo/",
    "stories": [
      {
        "label": "Memoria industrial",
        "title": "El legado de Bustiello",
        "text": "Un conjunto que ayuda a entender la vida y el patrimonio minero.",
        "href": "https://www.mieres.es/turismo/nuestros-pueblos/bustiello/"
      },
      {
        "label": "Valles con historia",
        "title": "Turón, paisaje y memoria",
        "text": "La huella industrial y la naturaleza se encuentran en el valle.",
        "href": "https://www.mieres.es/turismo/nuestros-pueblos/turon/"
      },
      {
        "label": "La vida aquí",
        "title": "Un paseo por Mieres",
        "text": "Pueblos, espacios culturales y lugares de encuentro para descubrir el concejo.",
        "href": "https://www.mieres.es/turismo/recorrido-conceyu-de-mieres/"
      }
    ]
  },
  "morcin": {
    "heroImagePath": "/morcin/panorama.webp",
    "heroImageAlt": "Paisaje de la cara sur del Monsacro, en Morcín",
    "heroImageCredit": "Ladera sur del Monsacro · Elfo del bosque · CC BY-SA 4.0 · Archivo",
    "heroImageSource": "https://commons.wikimedia.org/wiki/File:Monsacro.JPG",
    "heroImageLicenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "title": "Morcín, naturaleza con raíces.",
    "subtitle": "A los pies del Monsacro. Cerca de nuestros pueblos.",
    "crestPath": "/morcin/escudo.svg",
    "crestCredit": "SanchoPanzaXXI · CC BY-SA 4.0",
    "crestSource": "https://commons.wikimedia.org/wiki/File:Escudo_de_Morc%C3%ADn.svg",
    "crestLicenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "colors": {
      "accent": "#676344",
      "dark": "#3c3c2c",
      "soft": "#eeeedf",
      "border": "#d7d8bd"
    },
    "official": "https://www.morcin.es/",
    "tourism": "https://www.morcin.es/ruta-perimetral-del-monsacro",
    "stories": [
      {
        "label": "Montaña y caminos",
        "title": "El Monsacro, nuestro horizonte",
        "text": "Un paisaje de referencia para acercarse a los caminos de Morcín.",
        "href": "https://www.morcin.es/ruta-perimetral-del-monsacro"
      },
      {
        "label": "Memoria y oficios",
        "title": "La historia de la lechería",
        "text": "La Foz conecta la memoria minera con el patrimonio de la lechería.",
        "href": "https://www.morcin.es/historia"
      },
      {
        "label": "Vida en los pueblos",
        "title": "Descubre Morcín",
        "text": "Pueblos y entorno rural para conocer el concejo con tiempo.",
        "href": "https://www.turismoasturias.es/descubre/donde-ir/municipios/morcin"
      }
    ]
  },
  "riosa": {
    "heroImagePath": "/riosa/panorama.webp",
    "heroImageAlt": "Paisaje de montaña durante la subida por la sierra del Aramo en Riosa",
    "heroImageCredit": "Sierra del Aramo, Riosa · Ezequielcabo · CC BY-SA 3.0 es · Archivo",
    "heroImageSource": "https://commons.wikimedia.org/wiki/File:Subiendo_por_la_Sierra_del_Aramo_,_Riosa.JPG",
    "heroImageLicenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/es/deed.en",
    "title": "Riosa, donde empieza la cima.",
    "subtitle": "El Angliru como horizonte. Nuestros pueblos como origen.",
    "crestPath": "/riosa/escudo.jpg",
    "crestCredit": "Alvaroggallardo · CC BY-SA 4.0",
    "crestSource": "https://commons.wikimedia.org/wiki/File:Escudo_riosa.jpg",
    "crestLicenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "colors": {
      "accent": "#4d6850",
      "dark": "#2d4030",
      "soft": "#e9eee4",
      "border": "#cedbc9"
    },
    "official": "https://www.ayuntamientoriosa.com/",
    "tourism": "https://www.turismoasturias.es/descubre/donde-ir/municipios/riosa",
    "stories": [
      {
        "label": "Ciclismo y montaña",
        "title": "El Angliru",
        "text": "Una referencia del ciclismo y una ventana al paisaje de Riosa.",
        "href": "https://www.turismoasturias.es/descubre/donde-ir/municipios/riosa"
      },
      {
        "label": "Memoria del territorio",
        "title": "Las minas de Texeo",
        "text": "Una huella de la minería del cobre en las laderas del Aramo.",
        "href": "https://www.ayuntamientoriosa.com/mapa-web"
      },
      {
        "label": "Naturaleza",
        "title": "La sierra del Aramo",
        "text": "Paisajes y caminos para acercarse al concejo con otra mirada.",
        "href": "https://www.turismoasturias.es/descubre/donde-ir/municipios/riosa"
      }
    ]
  },
  "ribera-de-arriba": {
    "heroImagePath": "/ribera-de-arriba/panorama.webp",
    "heroImageAlt": "Hórreo y casas en Palombar, Ribera de Arriba",
    "heroImageCredit": "Hórreo de Palombar · Pachug · CC BY-SA 3.0 · Archivo",
    "heroImageSource": "https://commons.wikimedia.org/wiki/File:Horru.jpg",
    "heroImageLicenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "title": "Ribera, un lugar para encontrarse.",
    "subtitle": "Entre ríos, pueblos y tradiciones que siguen vivas.",
    "crestPath": "/ribera-de-arriba/escudo.svg",
    "crestCredit": "SanchoPanzaXXI · CC BY-SA 4.0",
    "crestSource": "https://commons.wikimedia.org/wiki/File:Escudo_de_Ribera_de_Arriba.svg",
    "crestLicenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "colors": {
      "accent": "#386a73",
      "dark": "#24474d",
      "soft": "#e4eff0",
      "border": "#c4dadc"
    },
    "official": "https://www.ayto-riberadearriba.es/portada",
    "tourism": "https://www.turismoasturias.es/descubre/donde-ir/municipios/ribera-de-arriba",
    "stories": [
      {
        "label": "Patrimonio vivo",
        "title": "Los hórreos de Bueño",
        "text": "Un paseo por la arquitectura tradicional y la vida rural.",
        "href": "https://www.turismoasturias.es/descubre/donde-ir/municipios/ribera-de-arriba"
      },
      {
        "label": "Cultura y memoria",
        "title": "Entender el hórreo",
        "text": "El centro de interpretación acerca este patrimonio a todas las edades.",
        "href": "https://www.turismoasturias.es/descubre/cultura/museos-y-espacios-culturales/otros-espacios/centro-de-interpretacion-del-horreo"
      },
      {
        "label": "Entre dos ríos",
        "title": "Caudal y Nalón se encuentran",
        "text": "El agua y el paisaje ayudan a explicar la identidad de Ribera.",
        "href": "https://www.turismoasturias.es/descubre/donde-ir/municipios/ribera-de-arriba"
      }
    ]
  }
}

async function loadIdentities(db: MigrateUpArgs['db']) {
  for (const [legacyID, v] of Object.entries(seed)) {
    const rows = (await db.execute(sql`SELECT id FROM municipal_spaces WHERE legacy_i_d = ${legacyID} AND identity_title IS NULL AND identity_hero_image_path IS NULL`)).rows as { id: number }[]
    for (const { id } of rows) {
      await db.execute(sql`UPDATE municipal_spaces SET identity_hero_image_path = ${v.heroImagePath}, identity_hero_image_alt = ${v.heroImageAlt},
        identity_hero_image_credit = ${v.heroImageCredit}, identity_hero_image_source = ${v.heroImageSource}, identity_hero_image_license_url = ${v.heroImageLicenseUrl},
        identity_title = ${v.title}, identity_subtitle = ${v.subtitle}, identity_crest_path = ${v.crestPath}, identity_crest_credit = ${v.crestCredit},
        identity_crest_source = ${v.crestSource}, identity_crest_license_url = ${v.crestLicenseUrl}, identity_colors_accent = ${v.colors.accent},
        identity_colors_dark = ${v.colors.dark}, identity_colors_soft = ${v.colors.soft}, identity_colors_border = ${v.colors.border},
        identity_official = ${v.official}, identity_tourism = ${v.tourism} WHERE id = ${id}`)
      // La última versión es la que abre el CMS (borradores): lleva los mismos valores, para que guardar no los borre.
      const versions = (await db.execute(sql`SELECT id FROM _municipal_spaces_v WHERE parent_id = ${id} AND latest = true`)).rows as { id: number }[]
      for (const version of versions) {
        await db.execute(sql`UPDATE _municipal_spaces_v SET version_identity_hero_image_path = ${v.heroImagePath}, version_identity_hero_image_alt = ${v.heroImageAlt},
          version_identity_hero_image_credit = ${v.heroImageCredit}, version_identity_hero_image_source = ${v.heroImageSource}, version_identity_hero_image_license_url = ${v.heroImageLicenseUrl},
          version_identity_title = ${v.title}, version_identity_subtitle = ${v.subtitle}, version_identity_crest_path = ${v.crestPath}, version_identity_crest_credit = ${v.crestCredit},
          version_identity_crest_source = ${v.crestSource}, version_identity_crest_license_url = ${v.crestLicenseUrl}, version_identity_colors_accent = ${v.colors.accent},
          version_identity_colors_dark = ${v.colors.dark}, version_identity_colors_soft = ${v.colors.soft}, version_identity_colors_border = ${v.colors.border},
          version_identity_official = ${v.official}, version_identity_tourism = ${v.tourism} WHERE id = ${version.id}`)
      }
      for (const [order, story] of v.stories.entries()) {
        const rowID = randomBytes(12).toString('hex')
        await db.execute(sql`INSERT INTO municipal_spaces_identity_stories (_order, _parent_id, id, label, title, text, href) VALUES (${order + 1}, ${id}, ${rowID}, ${story.label}, ${story.title}, ${story.text}, ${story.href})`)
        for (const version of versions) {
          await db.execute(sql`INSERT INTO _municipal_spaces_v_version_identity_stories (_order, _parent_id, label, title, text, href, _uuid) VALUES (${order + 1}, ${version.id}, ${story.label}, ${story.title}, ${story.text}, ${story.href}, ${rowID})`)
        }
      }
    }
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "municipal_spaces_identity_stories" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"title" varchar,
  	"text" varchar,
  	"href" varchar
  );
  
  CREATE TABLE "_municipal_spaces_v_version_identity_stories" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"title" varchar,
  	"text" varchar,
  	"href" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_hero_image_id" integer;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_hero_image_path" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_hero_image_alt" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_hero_image_credit" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_hero_image_source" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_hero_image_license_url" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_title" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_subtitle" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_crest_image_id" integer;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_crest_path" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_crest_credit" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_crest_source" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_crest_license_url" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_colors_accent" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_colors_dark" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_colors_soft" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_colors_border" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_official" varchar;
  ALTER TABLE "municipal_spaces" ADD COLUMN "identity_tourism" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_hero_image_id" integer;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_hero_image_path" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_hero_image_alt" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_hero_image_credit" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_hero_image_source" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_hero_image_license_url" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_title" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_subtitle" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_crest_image_id" integer;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_crest_path" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_crest_credit" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_crest_source" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_crest_license_url" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_colors_accent" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_colors_dark" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_colors_soft" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_colors_border" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_official" varchar;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_identity_tourism" varchar;
  ALTER TABLE "municipal_spaces_identity_stories" ADD CONSTRAINT "municipal_spaces_identity_stories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."municipal_spaces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_municipal_spaces_v_version_identity_stories" ADD CONSTRAINT "_municipal_spaces_v_version_identity_stories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_municipal_spaces_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "municipal_spaces_identity_stories_order_idx" ON "municipal_spaces_identity_stories" USING btree ("_order");
  CREATE INDEX "municipal_spaces_identity_stories_parent_id_idx" ON "municipal_spaces_identity_stories" USING btree ("_parent_id");
  CREATE INDEX "_municipal_spaces_v_version_identity_stories_order_idx" ON "_municipal_spaces_v_version_identity_stories" USING btree ("_order");
  CREATE INDEX "_municipal_spaces_v_version_identity_stories_parent_id_idx" ON "_municipal_spaces_v_version_identity_stories" USING btree ("_parent_id");
  ALTER TABLE "municipal_spaces" ADD CONSTRAINT "municipal_spaces_identity_hero_image_id_media_id_fk" FOREIGN KEY ("identity_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "municipal_spaces" ADD CONSTRAINT "municipal_spaces_identity_crest_image_id_media_id_fk" FOREIGN KEY ("identity_crest_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_municipal_spaces_v" ADD CONSTRAINT "_municipal_spaces_v_version_identity_hero_image_id_media_id_fk" FOREIGN KEY ("version_identity_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_municipal_spaces_v" ADD CONSTRAINT "_municipal_spaces_v_version_identity_crest_image_id_media_id_fk" FOREIGN KEY ("version_identity_crest_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "municipal_spaces_identity_identity_hero_image_idx" ON "municipal_spaces" USING btree ("identity_hero_image_id");
  CREATE INDEX "municipal_spaces_identity_identity_crest_image_idx" ON "municipal_spaces" USING btree ("identity_crest_image_id");
  CREATE INDEX "_municipal_spaces_v_version_identity_version_identity_he_idx" ON "_municipal_spaces_v" USING btree ("version_identity_hero_image_id");
  CREATE INDEX "_municipal_spaces_v_version_identity_version_identity_cr_idx" ON "_municipal_spaces_v" USING btree ("version_identity_crest_image_id");`)
  await loadIdentities(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "municipal_spaces_identity_stories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_municipal_spaces_v_version_identity_stories" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "municipal_spaces_identity_stories" CASCADE;
  DROP TABLE "_municipal_spaces_v_version_identity_stories" CASCADE;
  ALTER TABLE "municipal_spaces" DROP CONSTRAINT "municipal_spaces_identity_hero_image_id_media_id_fk";
  
  ALTER TABLE "municipal_spaces" DROP CONSTRAINT "municipal_spaces_identity_crest_image_id_media_id_fk";
  
  ALTER TABLE "_municipal_spaces_v" DROP CONSTRAINT "_municipal_spaces_v_version_identity_hero_image_id_media_id_fk";
  
  ALTER TABLE "_municipal_spaces_v" DROP CONSTRAINT "_municipal_spaces_v_version_identity_crest_image_id_media_id_fk";
  
  DROP INDEX "municipal_spaces_identity_identity_hero_image_idx";
  DROP INDEX "municipal_spaces_identity_identity_crest_image_idx";
  DROP INDEX "_municipal_spaces_v_version_identity_version_identity_he_idx";
  DROP INDEX "_municipal_spaces_v_version_identity_version_identity_cr_idx";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_hero_image_id";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_hero_image_path";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_hero_image_alt";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_hero_image_credit";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_hero_image_source";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_hero_image_license_url";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_title";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_subtitle";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_crest_image_id";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_crest_path";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_crest_credit";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_crest_source";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_crest_license_url";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_colors_accent";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_colors_dark";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_colors_soft";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_colors_border";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_official";
  ALTER TABLE "municipal_spaces" DROP COLUMN "identity_tourism";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_hero_image_id";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_hero_image_path";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_hero_image_alt";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_hero_image_credit";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_hero_image_source";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_hero_image_license_url";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_title";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_subtitle";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_crest_image_id";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_crest_path";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_crest_credit";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_crest_source";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_crest_license_url";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_colors_accent";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_colors_dark";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_colors_soft";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_colors_border";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_official";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_identity_tourism";`)
}
