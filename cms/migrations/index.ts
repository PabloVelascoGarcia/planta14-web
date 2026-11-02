import * as migration_20261102_085958_fase1 from './20261102_085958_fase1';
import * as migration_20261102_090101_storage from './20261102_090101_storage';
import * as migration_20261102_094653_bloque2 from './20261102_094653_bloque2';

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
    name: '20261102_094653_bloque2'
  },
];
