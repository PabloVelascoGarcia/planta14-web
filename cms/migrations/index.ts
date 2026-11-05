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
import * as migration_20261104_200318_fiestas from './20261104_200318_fiestas';
import * as migration_20261104_201144_suscriptores from './20261104_201144_suscriptores';
import * as migration_20261104_202002_ultima_hora from './20261104_202002_ultima_hora';
import * as migration_20261104_205214_cartas from './20261104_205214_cartas';
import * as migration_20261104_205655_sugerencias from './20261104_205655_sugerencias';
import * as migration_20261104_210500_estadisticas from './20261104_210500_estadisticas';
import * as migration_20261104_215338_util from './20261104_215338_util';
import * as migration_20261104_221803_util_ocultar from './20261104_221803_util_ocultar';
import * as migration_20261105_081647_correcciones from './20261105_081647_correcciones';
import * as migration_20261105_092717_pie from './20261105_092717_pie';
import * as migration_20261105_102329_util_activacion from './20261105_102329_util_activacion';
import * as migration_20261105_143455_cartas_activas from './20261105_143455_cartas_activas';

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
    name: '20261104_195227_responsables',
  },
  {
    up: migration_20261104_200318_fiestas.up,
    down: migration_20261104_200318_fiestas.down,
    name: '20261104_200318_fiestas',
  },
  {
    up: migration_20261104_201144_suscriptores.up,
    down: migration_20261104_201144_suscriptores.down,
    name: '20261104_201144_suscriptores',
  },
  {
    up: migration_20261104_202002_ultima_hora.up,
    down: migration_20261104_202002_ultima_hora.down,
    name: '20261104_202002_ultima_hora',
  },
  {
    up: migration_20261104_205214_cartas.up,
    down: migration_20261104_205214_cartas.down,
    name: '20261104_205214_cartas',
  },
  {
    up: migration_20261104_205655_sugerencias.up,
    down: migration_20261104_205655_sugerencias.down,
    name: '20261104_205655_sugerencias',
  },
  {
    up: migration_20261104_210500_estadisticas.up,
    down: migration_20261104_210500_estadisticas.down,
    name: '20261104_210500_estadisticas',
  },
  {
    up: migration_20261104_215338_util.up,
    down: migration_20261104_215338_util.down,
    name: '20261104_215338_util',
  },
  {
    up: migration_20261104_221803_util_ocultar.up,
    down: migration_20261104_221803_util_ocultar.down,
    name: '20261104_221803_util_ocultar',
  },
  {
    up: migration_20261105_081647_correcciones.up,
    down: migration_20261105_081647_correcciones.down,
    name: '20261105_081647_correcciones',
  },
  {
    up: migration_20261105_092717_pie.up,
    down: migration_20261105_092717_pie.down,
    name: '20261105_092717_pie',
  },
  {
    up: migration_20261105_102329_util_activacion.up,
    down: migration_20261105_102329_util_activacion.down,
    name: '20261105_102329_util_activacion',
  },
  {
    up: migration_20261105_143455_cartas_activas.up,
    down: migration_20261105_143455_cartas_activas.down,
    name: '20261105_143455_cartas_activas',
  },
];
