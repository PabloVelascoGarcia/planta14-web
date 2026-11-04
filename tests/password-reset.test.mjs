import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Correo de «He olvidado mi contraseña» (cms/password-reset.ts).
const code = ts.transpileModule(fs.readFileSync('cms/password-reset.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const m = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const server = 'https://pruebas.planta14.com';

// Redacción: la página de Payload en /cms. Municipal: su panel, con el token tras «#».
assert.equal(m.resetLink(server, 'abc123', null), `${server}/cms/reset/abc123`);
assert.equal(m.resetLink(`${server}/`, 'abc123', 'mieres'), `${server}/mieres/panel/restablecer#token=abc123`);
assert.equal(m.resetLink(server, 'a/b', 'ribera-de-arriba'), `${server}/ribera-de-arriba/panel/restablecer#token=a%2Fb`);

const fakeReq = (spaces) => ({ payload: { config: { serverURL: server }, findByID: async ({ collection, id }) => {
  assert.equal(collection, 'municipal-spaces');
  if (!spaces[id]) throw new Error('not found');
  return spaces[id];
} } });
const req = fakeReq({ 1: { legacyID: 'mieres', name: 'Ayuntamiento de Mieres' }, 2: { legacyID: null, name: 'Ayuntamiento de Riosa', town: { slug: 'riosa' } } });
const html = async (user) => m.forgotPasswordOptions.generateEmailHTML({ req, token: 'tok', user });

const municipal = await html({ name: 'Prueba <Mieres>', role: 'municipal', municipalSpace: 1 });
assert.match(municipal, /href="https:\/\/pruebas\.planta14\.com\/mieres\/panel\/restablecer#token=tok"/);
assert.doesNotMatch(municipal, /\/cms\/reset/);
assert.match(municipal, /tu cuenta del panel de Ayuntamiento de Mieres en Planta 14/);
assert.match(municipal, /Hola, Prueba &lt;Mieres&gt;:/, 'el nombre se escapa');
assert.match(municipal, /una hora/);
assert.equal(await html({ role: 'municipal', municipalSpace: { id: 1 } }), municipal.replace('Hola, Prueba &lt;Mieres&gt;:', 'Hola:'));

const editor = await html({ name: 'Andrés', role: 'editor' });
assert.match(editor, /href="https:\/\/pruebas\.planta14\.com\/cms\/reset\/tok"/);
assert.match(editor, /tu cuenta de la redacción de Planta 14/);
// Espacio sin identificador de origen: la dirección del concejo (como la web pública).
assert.match(await html({ role: 'municipal', municipalSpace: 2 }), /href="https:\/\/pruebas\.planta14\.com\/riosa\/panel\/restablecer#token=tok"/);
assert.equal(m.MIN_PASSWORD_LENGTH, 12);
// Cuenta municipal cuyo espacio ya no existe: enlace de /cms (no se rompe el envío).
assert.match(await html({ role: 'municipal', municipalSpace: 99 }), /\/cms\/reset\/tok/);

assert.equal(m.forgotPasswordOptions.generateEmailSubject(), 'Planta 14: cambia tu contraseña');
assert.equal(m.forgotPasswordOptions.expiration, 60 * 60 * 1000);
// Sin recursos externos (imágenes, hojas de estilo ni scripts).
assert.doesNotMatch(municipal, /<img|<link|<script/);
console.log('PASS password-reset');
