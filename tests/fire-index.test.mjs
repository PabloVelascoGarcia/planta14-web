import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Índice de riesgo de incendios (lib/fire-index.ts): lectura estricta de la página del 112 Asturias. Un cambio de formato
// no puede dar un nivel equivocado: la lectura falla y la web muestra solo el enlace a la página oficial.
const code = ts.transpileModule(fs.readFileSync('lib/fire-index.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { parseFireIndex, fireIndexForToday, FireIndexFormatError, fireTextColor } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

const towns = { mieres: 'Mieres', lena: 'Lena', aller: 'Aller', morcin: 'Morcín', riosa: 'Riosa', 'ribera-de-arriba': 'Ribera de Arriba' };
// Página sintética con la estructura de la del 112 (fecha, leyenda y lista de los 78 concejos).
const others = Array.from({ length: 72 }, (_, i) => `CONCEJO ${i + 1}`);
const page = ({ date = '07/11/2026', listClass = 'lista_indices_concejos', rows } = {}) => `<html><body>
  <div id="fecha_incendios"><span class="fecha_incendios_actual">${date}</span></div>
  <ul id="leyenda" class="indice_incendios"><li><span class="indice_bajo">1</span> Bajo</li></ul>
  <h2 class="tit_indices_concejos">&Iacute;ndices de incendio para los concejos de Asturias</h2>
  <ul class="${listClass}">${(rows ?? [
    ['indice_bajo', '1', 'ALLER'], ['indice_moderado', '2', 'LENA'], ['indice_alto', '3', 'MIERES'], ['indice_muy_alto', '4', 'MORC&Iacute;N'],
    ['indice_extremo', '5', 'RIBERA DE ARRIBA'], ['indice_sin_datos', '&nbsp;', 'RIOSA'], ...others.map(n => ['indice_bajo', '1', n]),
  ]).map(([cls, n, name]) => `\n\t\t<li><span class="${cls}">${n}</span> ${name}</li>`).join('')}\n\t</ul></body></html>`;

const good = parseFireIndex(page(), towns);
assert.equal(good.day, '2026-11-07');
assert.deepEqual(Object.fromEntries(Object.entries(good.levels).map(([k, v]) => [k, `${v.level} ${v.label}`])),
  { aller: '1 Bajo', lena: '2 Moderado', mieres: '3 Alto', morcin: '4 Muy alto', 'ribera-de-arriba': '5 Extremo' }, 'levels per concejo (Riosa «sin información»: no level)');
assert.equal(parseFireIndex(page({ rows: [['indice_recurrencia', '5', 'ALLER'], ...['LENA', 'MIERES', 'MORCÍN', 'RIBERA DE ARRIBA', 'RIOSA', ...others].map(n => ['indice_bajo', '1', n])] }), towns).levels.aller.label, 'Extremo (recurrencia)');

// Cambios de formato simulados: nunca un nivel, siempre un error.
const broken = {
  'sin fecha': page({ date: '' }), 'fecha con otro formato': page({ date: '2026-11-07' }), 'lista renombrada': page({ listClass: 'indices_concejos_v2' }),
  'clase desconocida': page({ rows: [['indice_naranja', '3', 'ALLER'], ...['LENA', 'MIERES', 'MORCÍN', 'RIBERA DE ARRIBA', 'RIOSA', ...others].map(n => ['indice_bajo', '1', n])] }),
  'número que no cuadra': page({ rows: [['indice_bajo', '4', 'ALLER'], ...['LENA', 'MIERES', 'MORCÍN', 'RIBERA DE ARRIBA', 'RIOSA', ...others].map(n => ['indice_bajo', '1', n])] }),
  'falta un concejo': page({ rows: ['LENA', 'MIERES', 'MORCÍN', 'RIBERA DE ARRIBA', 'RIOSA', ...others].map(n => ['indice_bajo', '1', n]) }),
  'lista recortada': page({ rows: ['ALLER', 'LENA', 'MIERES', 'MORCÍN', 'RIBERA DE ARRIBA', 'RIOSA'].map(n => ['indice_bajo', '1', n]) }),
  'página vacía': '', 'página de error': '<html><body><h1>503 Service Unavailable</h1></body></html>',
};
for (const [what, html] of Object.entries(broken)) assert.throws(() => parseFireIndex(html, towns), FireIndexFormatError, what);

// Solo se muestra el índice de hoy y si la última lectura fue buena.
assert.equal(fireIndexForToday({ data: good, error: null }, '2026-11-07'), good);
assert.equal(fireIndexForToday({ data: good, error: null }, '2026-11-08'), null, 'yesterday’s index is not shown');
assert.equal(fireIndexForToday({ data: good, error: 'Formato inesperado' }, '2026-11-07'), null, 'last read failed: not shown');
assert.equal(fireIndexForToday({ data: null, error: null }, '2026-11-07'), null);
assert.equal(fireTextColor(2), '#1d1a14'); assert.equal(fireTextColor(5), '#ffffff');
// Cada nivel, con su texto, tiene contraste AA (4,5:1).
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
for (const level of Object.values(parseFireIndex(page(), towns).levels)) assert.ok(ratio(level.color, fireTextColor(level.level)) >= 4.5, `contrast ${level.label}`);
console.log('PASS: fire risk index (112 Asturias): strict reading per concejo (levels 1-5, «sin información», recurrencia); any format change (date, list, class, number, missing concejo, short list, error page) gives no level; only today’s index after a good read is shown');
