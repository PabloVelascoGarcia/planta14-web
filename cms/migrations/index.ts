import * as migration_20261102_085958_fase1 from './20261102_085958_fase1';
import * as migration_20261102_090101_storage from './20261102_090101_storage';
import * as migration_20261102_094653_bloque2 from './20261102_094653_bloque2';
import * as migration_20261102_105932_bloque3 from './20261102_105932_bloque3';
import * as migration_20261102_121412_integracion from './20261102_121412_integracion';
import * as migration_20261102_174946_mostrar_en_concejo from './20261102_174946_mostrar_en_concejo';
import * as migration_20261103_000335_identidad_espacios from './20261103_000335_identidad_espacios';
import * as migration_20261103_001210_creado_por from './20261103_001210_creado_por';
import * as migration_20261103_081533_lote_ensayo from './20261103_081533_lote_ensayo';
import * as migration_20261103_121545_formulario_noticias from './20261103_121545_formulario_noticias';
import * as migration_20261104_195227_responsables from './20261104_195227_responsables';

export const migrations = [
  {
    up: migration_20261102_085958_fase1.up,
    down: migration_20261102_085958_fase1.down,
    name: '20261102_085958_fase1',
  },
  {
    up: migration_20261102_090101_storage.up,
    down: migration_20261102_090101_storage.down,
    name: '20261102_090101_storage',
  },
  {
    up: migration_20261102_094653_bloque2.up,
    down: migration_20261102_094653_bloque2.down,
    name: '20261102_094653_bloque2',
  },
  {
    up: migration_20261102_105932_bloque3.up,
    down: migration_20261102_105932_bloque3.down,
    name: '20261102_105932_bloque3',
  },
  {
    up: migration_20261102_121412_integracion.up,
    down: migration_20261102_121412_integracion.down,
    name: '20261102_121412_integracion',
  },
  {
    up: migration_20261102_174946_mostrar_en_concejo.up,
    down: migration_20261102_174946_mostrar_en_concejo.down,
    name: '20261102_174946_mostrar_en_concejo',
  },
  {
    up: migration_20261103_000335_identidad_espacios.up,
    down: migration_20261103_000335_identidad_espacios.down,
    name: '20261103_000335_identidad_espacios',
  },
  {
    up: migration_20261103_001210_creado_por.up,
    down: migration_20261103_001210_creado_por.down,
    name: '20261103_001210_creado_por',
  },
  {
    up: migration_20261103_081533_lote_ensayo.up,
    down: migration_20261103_081533_lote_ensayo.down,
    name: '20261103_081533_lote_ensayo',
  },
  {
    up: migration_20261103_121545_formulario_noticias.up,
    down: migration_20261103_121545_formulario_noticias.down,
    name: '20261103_121545_formulario_noticias',
  },
  {
    up: migration_20261104_195227_responsables.up,
    down: migration_20261104_195227_responsables.down,
    name: '20261104_195227_responsables'
  },
];
