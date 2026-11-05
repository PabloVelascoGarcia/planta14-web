// Bloque «Útil» de scripts/participacion-integration.mjs: fuentes simuladas (DGT, AEMET, BDNS y BOE en un servidor local),
// caché, fallo de una fuente con aviso por correo, estado manual de invierno, importadores y directorio municipal.
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const mockPort = 59014, mock = `http://127.0.0.1:${mockPort}`;
const record = (id, road, km, municipality, province, inner) => `<sit:situationRecord xsi:type="sit:RoadOrCarriagewayOrLaneManagement" id="${id}" version="1">
  <sit:validity><com:validityStatus>active</com:validityStatus><com:validityTimeSpecification><com:overallStartTime>2026-11-04T06:30:00.000+01:00</com:overallStartTime></com:validityTimeSpecification></sit:validity>
  ${inner}<sit:locationReference><loc:roadInformation><loc:roadDestination>LEÓN</loc:roadDestination><loc:roadName>${road}</loc:roadName></loc:roadInformation>
  <loc:pointCoordinates><loc:latitude>43.0</loc:latitude><loc:longitude>-5.77</loc:longitude></loc:pointCoordinates>
  <lse:autonomousCommunity>x</lse:autonomousCommunity><lse:kilometerPoint>${km}</lse:kilometerPoint><lse:municipality>${municipality}</lse:municipality><lse:province>${province}</lse:province></sit:locationReference></sit:situationRecord>`;
const snow = '<sit:cause><sit:causeType>poorEnvironment</sit:causeType><sit:detailedCauseType><sit:poorEnvironmentType>snowfall</sit:poorEnvironmentType></sit:detailedCauseType></sit:cause><sit:roadOrCarriagewayOrLaneManagementType>roadClosed</sit:roadOrCarriagewayOrLaneManagementType>';
const works = '<sit:cause><sit:causeType>roadMaintenance</sit:causeType></sit:cause><sit:roadOrCarriagewayOrLaneManagementType>laneClosures</sit:roadOrCarriagewayOrLaneManagementType>';
const DGT = `<?xml version="1.0" encoding="UTF-8"?><d2:payload><com:publicationTime>2026-11-04T21:00:00.000+01:00</com:publicationTime><sit:situation id="1">
${record('p1', 'N-630', '85.0', 'Lena', 'Asturias', snow)}${record('p2', 'N-630', '70.0', 'Villamanín', 'León', works)}${record('s1', 'AS-112', '17.4', 'Aller', 'Asturias', works)}
${record('m1', 'A-66', '52.0', 'Mieres', 'Asturias', works)}${record('o1', 'N-630', '10.0', 'Oviedo', 'Asturias', works)}${record('l1', 'N-630', '200.0', 'León', 'León', works)}</sit:situation></d2:payload>`;
const forecast = name => [{ origen: {}, elaborado: '2026-11-04T19:00:00', nombre: name, provincia: 'Asturias', prediccion: { dia: [0, 1, 2, 3].map(n => ({ fecha: `2026-11-0${5 + n}T00:00:00`,
  estadoCielo: [{ value: '', periodo: '00-24', descripcion: '' }, { value: '36', periodo: '00-12', descripcion: n ? 'Intervalos nubosos' : 'Nieve débil' }],
  probPrecipitacion: [{ value: 80, periodo: '00-24' }, { value: 40, periodo: '00-12' }], cotaNieveProv: [{ value: '900', periodo: '00-24' }], temperatura: { maxima: 9 - n, minima: 1 } })) } }];
const bdnsList = [
  { numeroConvocatoria: '900001', descripcion: 'AYUDAS A LA REHABILITACIÓN DE FACHADAS EN POLA DE LENA 2026', nivel1: 'LOCAL', nivel2: 'LENA', nivel3: 'AYUNTAMIENTO DE LENA' },
  { numeroConvocatoria: '900002', descripcion: 'Subvenciones para el fomento del empleo autónomo', nivel1: 'AUTONOMICA', nivel2: 'PRINCIPADO DE ASTURIAS', nivel3: 'CONSEJERÍA DE ECONOMÍA' },
  { numeroConvocatoria: '900003', descripcion: 'AYUDAS AL COMERCIO DE GIJÓN', nivel1: 'LOCAL', nivel2: 'GIJÓN', nivel3: 'AYUNTAMIENTO DE GIJÓN' },
  { numeroConvocatoria: '900004', descripcion: 'SUBVENCIÓN NOMINATIVA AL CLUB DE MONTAÑA DE MIERES', nivel1: 'LOCAL', nivel2: 'MIERES', nivel3: 'AYUNTAMIENTO DE MIERES' },
  { numeroConvocatoria: '900005', descripcion: 'CONCESIÓN DIRECTA A LA ASOCIACIÓN VECINAL', nivel1: 'LOCAL', nivel2: 'MIERES', nivel3: 'AYUNTAMIENTO DE MIERES' },
  { numeroConvocatoria: '900006', descripcion: 'BECAS DE TRANSPORTE ESCOLAR (CERRADA)', nivel1: 'LOCAL', nivel2: 'ALLER', nivel3: 'AYUNTAMIENTO DE ALLER' },
  { numeroConvocatoria: '900007', descripcion: 'Ayudas a proyectos de I+D+i empresarial', nivel1: 'AUTONOMICA', nivel2: 'PRINCIPADO DE ASTURIAS', nivel3: 'INSTITUTO DE DESARROLLO ECONÓMICO DEL PRINCIPADO DE ASTURIAS' },
].map(i => ({ ...i, fechaRecepcion: '2026-11-01' }));
const bdnsSpain = [
  { numeroConvocatoria: '900010', descripcion: 'Ayudas estatales para la digitalización de pymes', nivel1: 'ESTATAL', nivel2: 'MINISTERIO DE INDUSTRIA', nivel3: 'SECRETARÍA DE ESTADO' },
  { numeroConvocatoria: '900011', descripcion: 'Becas estatales ya cerradas', nivel1: 'ESTATAL', nivel2: 'MINISTERIO DE EDUCACIÓN', nivel3: 'SECRETARÍA DE ESTADO' },
  { numeroConvocatoria: '900001', descripcion: 'AYUDAS A LA REHABILITACIÓN DE FACHADAS EN POLA DE LENA 2026', nivel1: 'LOCAL', nivel2: 'LENA', nivel3: 'AYUNTAMIENTO DE LENA' },
].map(i => ({ ...i, fechaRecepcion: '2026-11-02' }));
const bdnsDetail = { '900001': { abierto: true, tipoConvocatoria: 'Concurrencia competitiva - canónica', fechaFinSolicitud: '2099-12-01' },
  '900002': { abierto: true, tipoConvocatoria: 'Concurrencia competitiva - canónica', fechaFinSolicitud: null, textFin: 'Hasta agotar el crédito' },
  '900005': { abierto: true, tipoConvocatoria: 'Concesión directa - instrumental', fechaFinSolicitud: '2099-01-01' },
  '900006': { abierto: false, tipoConvocatoria: 'Concurrencia competitiva - canónica', fechaFinSolicitud: '2020-01-01' },
  '900007': { abierto: true, tipoConvocatoria: 'Concurrencia competitiva - canónica', fechaFinSolicitud: '2099-03-15', sedeElectronica: 'https://sede.asturias.es/ejemplo' },
  '900010': { abierto: true, tipoConvocatoria: 'Concurrencia competitiva - canónica', fechaFinSolicitud: '2099-06-30' },
  '900011': { abierto: false, tipoConvocatoria: 'Concurrencia competitiva - canónica', fechaFinSolicitud: '2021-01-01' } };
const boeItem = (id, title, organ) => `<item><title>${title}</title><link>https://www.boe.es/diario_boe/txt.php?id=${id}</link><description>x</description>
<category>II. Autoridades y personal. - B. Oposiciones y concursos</category><category>${organ}</category><pubDate>Wed, 04 Nov 2026 00:00:00 +0100</pubDate></item>`;
const BOE = Buffer.from(`<?xml version="1.0" encoding="ISO-8859-1"?><rss version="2.0"><channel><title>BOE</title>
${boeItem('BOE-A-2026-90001', 'Resolución de 20 de octubre de 2026, del Ayuntamiento de Lena (Asturias), referente a la convocatoria para proveer dos plazas de Policía Local.', 'ADMINISTRACIÓN LOCAL')}
${boeItem('BOE-A-2026-90002', 'Resolución de 21 de octubre de 2026, de la Consejería de Salud, por la que se convoca proceso selectivo de enfermería.', 'COMUNIDAD AUTÓNOMA DEL PRINCIPADO DE ASTURIAS')}
${boeItem('BOE-A-2026-90003', 'Resolución de 22 de octubre de 2026, del Ayuntamiento de Getafe (Madrid), referente a la convocatoria de una plaza.', 'ADMINISTRACIÓN LOCAL')}
</channel></rss>`, 'latin1');

// Recorridos y fotos simulados para el importador (las descargas reales son de turismoasturias.es, Google Drive y Commons).
const line = (lat, lon, n, step = 0.0007) => Array.from({ length: n }, (_, i) => [lat + i * step, lon + Math.sin(i / 5) * step]);
const gpx = (...segments) => `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Prueba</name>${segments.map(points => `<trkseg>${points.map(([lat, lon]) => `<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><ele>500</ele></trkpt>`).join('')}</trkseg>`).join('')}</trk></gpx>`;
const plt = (points, datum = 'WGS 84') => `OziExplorer Track Point File Version 2.1\r\n${datum}\r\nAltitude is in Feet\r\nReserved 3\r\n0,4,255,Etapa,0,0,2,8421376,-1,0\r\n${points.length}\r\n${points.map(([lat, lon], i) => `  ${lat.toFixed(6)},  ${lon.toFixed(6)},${i ? 0 : 1}, 1000.0,40655.27, 22-abr.-11, 6:39:37`).join('\r\n')}\r\n`;
/** ZIP sin compresión (método 0), como los de las descargas federativas. */
function zip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content), fileName = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(fileName.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(fileName.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, fileName, data); centrals.push(central, fileName);
    offset += 30 + fileName.length + data.length;
  }
  const dir = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}
const TRACKS = {
  '/tracks/ruta.gpx': gpx(line(43.137, -5.527, 80)),
  '/tracks/gr.zip': zip({ 'gr_206/': '', 'gr_206/GR 206 Etapa 1 - Track.gpx': gpx(line(43.23, -5.88, 60)), 'gr_206/GR 206 Etapa 2 - Track.gpx': gpx(line(43.27, -5.86, 60)), 'gr_206/GR 206 Etapa 1 Variante ciclista - Track.gpx': gpx(line(43.20, -5.90, 60)) }),
  '/tracks/plt.zip': zip({ 'gr_106/GR 106 Etapa 1 - Track.plt': plt(line(43.36, -5.86, 50)), 'gr_106/GR 106 Etapa 2 - Track.plt': plt(line(43.30, -5.90, 50)) }),
  '/tracks/tokyo.plt': plt(line(43.26, -5.91, 40), 'Tokyo'),
};

export async function run(ctx) {
  const { payload, users, web, origin, passed, assert, browser, signIn, password, mails, page, stop, start, directory } = ctx;
  const { sql } = await import('@payloadcms/db-postgres');
  const db = query => payload.db.drizzle.execute(query);
  const state = { boe: 'ok', bdns: 'ok', hits: {}, caida: true, bdns429: 0, searches: 0, details: 0 };
  const jpeg = await ctx.sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#8a6a4a' } }).jpeg().toBuffer();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, mock);
    const hit = url.pathname.split('/')[1];
    state.hits[hit] = (state.hits[hit] ?? 0) + 1;
    const send = (status, body, type = 'application/json; charset=utf-8') => { res.writeHead(status, { 'Content-Type': type }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
    if (url.pathname === '/dgt.xml') return send(200, DGT, 'application/xml');
    if (url.pathname.startsWith('/aemet/api/prediccion/especifica/municipio/diaria/')) {
      if (req.headers.api_key !== 'clave-de-prueba') return send(401, { estado: 401, descripcion: 'API key invalido' });
      return send(200, { estado: 200, datos: `${mock}/aemet-datos/${url.pathname.split('/').pop()}` });
    }
    if (url.pathname.startsWith('/aemet-datos/')) return send(200, Buffer.from(JSON.stringify(forecast('Lena')), 'latin1'), 'application/json;charset=ISO-8859-15');
    if (url.pathname === '/bdns/api/convocatorias/busqueda') {
      state.searches++;
      if (state.bdns429 > 0) { state.bdns429--; res.writeHead(429, { 'Content-Type': 'text/plain', 'Retry-After': '0' }); return res.end('Too Many Requests'); }
      if (state.bdns !== 'ok') return send(503, 'caída');
      const regiones = url.searchParams.get('regiones');
      if (regiones === '8,9') return send(200, { content: bdnsList });
      if (regiones === '1' && url.searchParams.get('tipoAdministracion') === 'C') return send(200, { content: bdnsSpain });
      return send(400, { error: `regiones ${regiones}` });
    }
    if (url.pathname === '/bdns/api/convocatorias') state.details++;
    if (url.pathname === '/bdns/api/convocatorias') return send(200, bdnsDetail[url.searchParams.get('numConv')] ?? { abierto: false });
    if (TRACKS[url.pathname]) return send(200, TRACKS[url.pathname], 'application/octet-stream');
    if (url.pathname === '/tracks/caida.gpx') return state.caida ? send(500, 'error') : send(200, gpx(line(43.21, -5.76, 30)), 'application/gpx+xml');
    if (url.pathname === '/commons/prueba.jpg') return send(200, jpeg, 'image/jpeg');
    if (url.pathname === '/boe.xml') return state.boe === 'ok' ? send(200, BOE, 'application/rss+xml') : send(500, 'error');
    send(404, 'no');
  });
  await new Promise(r => server.listen(mockPort, '127.0.0.1', r));
  // El refresco en el servidor, rápido para la prueba: comprueba cada segundo, reintenta tras 100 ms y espera 1,5 s tras un fallo.
  const sources = { UTIL_DGT_URL: `${mock}/dgt.xml`, AEMET_BASE_URL: `${mock}/aemet`, AEMET_API_KEY: 'clave-de-prueba', UTIL_BDNS_URL: `${mock}/bdns`, UTIL_BOE_RSS_URL: `${mock}/boe.xml`,
    UTIL_REFRESH_DISABLED: 'false', UTIL_REFRESH_START_SECONDS: '1', UTIL_REFRESH_CHECK_SECONDS: '1', UTIL_RETRY_BASE_MS: '100', UTIL_BACKOFF_BASE_MS: '1500', UTIL_BDNS_PAUSE_MS: '0' };
  const waitFor = async (check, label, tries = 120) => { for (let i = 0; i < tries; i++) { if (await check()) return; await new Promise(r => setTimeout(r, 250)); } assert.fail(label); };
  try {
    await db(sql`DELETE FROM external_cache`);
    await stop(); await start(sources);

    const editorCookie = await signIn(users.editor.email);
    const as = cookie => ({ Cookie: cookie, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' });
    await payload.update({ collection: 'users', id: users.lena.id, overrideAccess: true, data: { password } });
    const lenaCookie = await signIn(users.lena.email);

    // Importadores con el formato de datos-servicios (ejemplos de docs/ejemplos; abajo, los archivos reales si están).
    // Asíncrono: el servidor simulado vive en este mismo proceso (spawnSync lo bloquearía).
    const cli = (kind, ...args) => runCli(['scripts/util-run.mjs', kind, ...args]);
    const runCli = (args, input) => new Promise(resolve => {
      const child = spawn(process.execPath, args, { env: process.env });
      let stdout = '', stderr = '';
      child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
      child.on('close', status => resolve({ status, stdout, stderr }));
      child.stdin.end(input ?? '');
    });
    const check = await cli('patrimonio', 'docs/ejemplos/patrimonio.json', '--solo-comprobar');
    assert.ok(check.status === 0 && check.stdout.includes('Se crearían 3 fichas de patrimonio') && check.stdout.includes('COMPROBACIÓN TERMINADA'), check.stdout + check.stderr);
    const bad = path.join(directory, 'rutas-mal.json');
    await writeFile(bad, JSON.stringify({ registros: [{ id: 'r1', nombre: 'Ruta buena', concejo: 'lena' }, { id: 'r2', nombre: 'Ruta mala', concejo: 'Gijón', coordenadas: { latitud: 40, longitud: -5 } }] }));
    const wrong = await cli('rutas', bad);
    assert.ok(wrong.status === 1 && wrong.stdout.includes('concejo desconocido «Gijón»') && wrong.stdout.includes('latitud fuera de Asturias'), wrong.stdout);
    assert.equal((await payload.count({ collection: 'routes', overrideAccess: true })).totalDocs, 0, 'nothing imported when there is an error');
    assert.equal((await cli('rutas', 'docs/ejemplos/rutas.json', '--publicr')).status, 2, 'unknown options rejected');
    const servicesImport = await cli('servicios', 'docs/ejemplos/servicios-municipales.json');
    assert.ok(servicesImport.status === 0 && servicesImport.stdout.includes('Creados 3 servicios municipales') && servicesImport.stdout.includes('No se importan: 1 farmacias'), servicesImport.stdout + servicesImport.stderr);
    for (const kind of ['patrimonio', 'rutas']) assert.ok((await cli(kind, `docs/ejemplos/${kind}.json`, '--solo-comprobar')).stdout.includes('COMPROBACIÓN TERMINADA'), `ejemplo ${kind}`);
    // Patrimonio y rutas con descargas (simuladas): foto de Commons, sin foto, sin coordenadas, UTM, dudosos; GPX, ZIP, PLT, Wikiloc.
    const commons = { paginaCommons: 'https://commons.wikimedia.org/wiki/File:Prueba_Santa_Cristina.jpg', autor: 'Autora de prueba', licencia: 'CC BY-SA 4.0', enlaceLicencia: 'https://creativecommons.org/licenses/by-sa/4.0', pie: 'Santa Cristina de Lena (foto de prueba)' };
    const heritage = { registros: [
      { id: 'fx-lena-santa-cristina', nombre: 'Santa Cristina de Lena', concejo: 'Lena', localidad: 'Felgueras', tipo: 'iglesia prerrománica', proteccionLegal: { figura: 'BIC, monumento', norma: 'Decreto de prueba', fuente: 'https://www.boe.es/' },
        coordenadas: { sistema: 'WGS84', latitud: 43.128594, longitud: -5.818, referencia: 'EJEMPLO: punto aproximado' }, descripcion: 'Iglesia de prueba.\n\nSegundo párrafo de ejemplo.',
        fuentesOficiales: ['https://www.turismoasturias.es/'], foto: { ...commons, archivoOriginal: `${mock}/commons/prueba.jpg` }, estado: 'comprobado', dudas: [] },
      { id: 'fx-mieres-bustiello', nombre: 'Poblado minero de Bustiello', concejo: 'Mieres', localidad: 'Bustiello', tipo: 'patrimonio minero', proteccionLegal: null, coordenadas: null,
        descripcion: 'Poblado de prueba.', fuentesOficiales: [], foto: null, estado: 'comprobado_con_pendientes', dudas: ['Dudoso: duda interna de prueba.'] },
      { id: 'fx-morcin-utm', nombre: 'Ermita con UTM', concejo: 'Morcín', localidad: null, tipo: 'ermita medieval', proteccionLegal: null, coordenadas: { sistema: 'UTM huso 30', x: 261911.3, y: 4797176.0 },
        descripcion: 'Ermita de prueba.', fuentesOficiales: [], foto: null, estado: 'comprobado', dudas: [] },
      { id: 'fx-riosa-foto-rota', nombre: 'Ficha con foto rota', concejo: 'Riosa', localidad: null, tipo: 'ermita', proteccionLegal: null, coordenadas: { sistema: 'WGS84', latitud: 43.18, longitud: -5.89 },
        descripcion: 'Prueba.', fuentesOficiales: [], foto: { ...commons, paginaCommons: 'https://commons.wikimedia.org/wiki/File:No_existe.jpg', archivoOriginal: `${mock}/commons/no-existe.jpg` }, estado: 'comprobado', dudas: [] },
    ] };
    const fixtureRoute = (id, nombre, concejo, extra = {}) => ({ id, nombre, codigo: null, concejo, otrosConcejos: [], inicio: null, fin: null, distanciaKm: null, distanciaCorrespondeA: null,
      desnivel: { positivoMetros: null, negativoMetros: null }, dificultad: null, tiempo: null, descripcion: `Ruta de prueba ${nombre}.`, gpxOficial: null, comprobacionGPX: null, enlaceAlternativo: null, fuentes: [], estado: 'comprobado', dudas: [], ...extra });
    const routes = { registros: [
      fixtureRoute('fx-ruta-aller', 'Ruta de ejemplo en Aller', 'Aller', { codigo: 'PR AS-00', otrosConcejos: ['Lena', 'Oviedo'], inicio: 'Soto de Agues', fin: 'Soto de Agues', distanciaKm: 9.5, distanciaCorrespondeA: 'Ida y vuelta, distancia total',
        desnivel: { positivoMetros: 450, negativoMetros: 450 }, dificultad: 'Media', tiempo: '3 h 30 min', gpxOficial: `${mock}/tracks/ruta.gpx`, fuentes: ['https://www.turismoasturias.es/'] }),
      fixtureRoute('fx-gr206', 'Gran Ruta de prueba', 'Riosa', { codigo: 'GR 206', enlaceAlternativo: `${mock}/tracks/gr.zip`, estado: 'comprobado_con_pendientes', dudas: ['Descarga federativa: ZIP con GPX de dos etapas y una variante ciclista.'] }),
      fixtureRoute('fx-plt-zip', 'Ruta PLT en ZIP', 'Ribera de Arriba', { enlaceAlternativo: `${mock}/tracks/plt.zip`, dudas: ['ZIP con tracks OziExplorer PLT.'] }),
      fixtureRoute('fx-plt-tokyo', 'Ruta PLT sin WGS84', 'Morcín', { enlaceAlternativo: `${mock}/tracks/tokyo.plt` }),
      fixtureRoute('fx-wikiloc', 'Ruta con Wikiloc', 'Morcín', { enlaceAlternativo: 'https://es.wikiloc.com/rutas-senderismo/prueba-1' }),
      fixtureRoute('fx-ruta-lena', 'Ruta de ejemplo en Lena', 'Lena'),
      fixtureRoute('fx-ruta-caida', 'Ruta con descarga caída', 'Mieres', { gpxOficial: `${mock}/tracks/caida.gpx` }),
    ] };
    const heritageFile = path.join(directory, 'patrimonio.json'), routesFile = path.join(directory, 'rutas.json');
    await writeFile(heritageFile, JSON.stringify(heritage)); await writeFile(routesFile, JSON.stringify(routes));
    const imported = await cli('patrimonio', heritageFile, '--publicar');
    assert.ok(imported.status === 0 && imported.stdout.includes('Creados 4 fichas de patrimonio publicadas') && imported.stdout.includes('Ficha con foto rota: no se pudo descargar la foto'), imported.stdout + imported.stderr);
    const routed = await cli('rutas', routesFile, '--publicar');
    assert.ok(routed.status === 0 && routed.stdout.includes('Creados 7 rutas publicadas') && routed.stdout.includes('Ruta PLT sin WGS84: sin recorrido dibujado (PLT sin datum WGS 84: no se convierte)')
      && routed.stdout.includes('Ruta con descarga caída: no se pudo descargar el recorrido (HTTP 500)') && !routed.stdout.includes('Ruta con Wikiloc:'), routed.stdout + routed.stderr);
    const doc = async (collection, externalID) => (await payload.find({ collection, where: { externalID: { equals: externalID } }, depth: 1, overrideAccess: true })).docs[0];
    const cristina = await doc('heritage', 'fx-lena-santa-cristina');
    assert.ok(cristina.image?.credit === 'Autora de prueba / Wikimedia Commons / CC BY-SA 4.0' && cristina.image.sourceURL === commons.paginaCommons && cristina.image.rightsScope === 'publicable'
      && cristina.image.rightsDeclaration?.statement?.includes('Wikimedia Commons') && cristina.image.width === 1600 && cristina.review === 'ok', 'Commons photo in Imágenes with author, licence and declaration');
    assert.deepEqual([(await doc('heritage', 'fx-mieres-bustiello')).review, (await doc('heritage', 'fx-morcin-utm')).review, (await doc('heritage', 'fx-riosa-foto-rota')).image ?? null], ['dudoso-coordenadas', 'coordenadas', null], 'review warnings; no photo when it fails');
    assert.ok((await doc('heritage', 'fx-morcin-utm')).coordinatesNote.includes('Pendiente de convertir a WGS84 (origen en UTM huso 30: x 261911.3, y 4797176)'), 'UTM kept as a note, not converted');
    const gr = await doc('routes', 'fx-gr206'), pltZip = await doc('routes', 'fx-plt-zip'), allerRoute = await doc('routes', 'fx-ruta-aller');
    assert.ok(gr.track.length === 2 && gr.trackNote === 'ZIP: 2 GPX (descartadas 1 variantes ciclistas)' && gr.gpxLabel === 'Descarga oficial de los tracks (ZIP)' && gr.review === 'dudoso', `GR 206: ${JSON.stringify([gr.trackNote, gr.gpxLabel, gr.review])}`);
    assert.ok(pltZip.track.length === 2 && pltZip.trackNote === 'ZIP: 2 PLT (WGS 84) convertidos' && pltZip.gpxLabel === 'Descarga oficial del track (OziExplorer PLT)', `PLT: ${JSON.stringify([pltZip.trackNote, pltZip.gpxLabel])}`);
    assert.ok(allerRoute.track.length === 1 && allerRoute.lat === allerRoute.track[0][0][0] && allerRoute.otherTowns.map(t => t.slug).join() === 'lena' && allerRoute.alsoIn === 'Lena, Oviedo' && allerRoute.gpxLabel === 'Track GPX oficial', 'direct GPX, start point, other concejos (also outside the six)');
    assert.ok(!(await doc('routes', 'fx-plt-tokyo')).track && (await doc('routes', 'fx-plt-tokyo')).gpxUrl.endsWith('tokyo.plt') && (await doc('routes', 'fx-plt-tokyo')).review === 'coordenadas', 'unreliable PLT: link only');
    assert.ok((await doc('routes', 'fx-wikiloc')).gpxLabel.includes('Wikiloc') && !state.hits.rutas, 'Wikiloc is linked, never downloaded');
    state.caida = false;
    const repeated = await cli('rutas', routesFile, '--publicar');
    assert.ok(repeated.stdout.includes('Creados 0 rutas') && repeated.stdout.includes('Completadas 1') && repeated.stdout.includes('Ruta con descarga caída (Mieres): recorrido') && repeated.stdout.includes('Ya existían 6'), repeated.stdout);
    assert.equal((await payload.count({ collection: 'routes', overrideAccess: true })).totalDocs, 7, 'no duplicates');
    assert.ok((await cli('patrimonio', heritageFile)).stdout.includes('Ya existían 4'), 'heritage repeatable');
    // Validación previa contra el esquema: todos los errores de una vez y nada escrito.
    const badServices = path.join(directory, 'servicios-mal.json');
    await writeFile(badServices, JSON.stringify({ registros: [
      { id: 'mal-1', nombre: 'Horario larguísimo', concejo: 'lena', tipo: 'ayuntamiento', horario: 'h'.repeat(600), telefonos: [] },
      { id: 'mal-2', nombre: '', concejo: 'lena', tipo: 'nada', telefonos: [] },
      { id: 'mal-3', nombre: 'Nombre demasiado largo '.repeat(10), concejo: 'Gijón', tipo: 'biblioteca', telefonos: [] },
      { id: 'ok-306', nombre: 'Centro de interpretación (horario de 306 caracteres)', concejo: 'Ribera de Arriba', tipo: 'oficina_turismo', horario: 'x'.repeat(306), telefonos: [] },
    ] }));
    const servicesBefore = (await payload.count({ collection: 'municipal-services', overrideAccess: true })).totalDocs;
    for (const flags of [['--solo-comprobar'], []]) {
      const checked = await cli('servicios', badServices, ...flags);
      assert.ok(checked.status === 1 && checked.stdout.includes('«Horario» tiene 600 caracteres (máximo 500)') && checked.stdout.includes('falta el nombre') && checked.stdout.includes('tipo desconocido «nada»')
        && checked.stdout.includes('«Nombre» tiene 229 caracteres (máximo 160)') && checked.stdout.includes('concejo desconocido «Gijón»') && !checked.stdout.includes('ok-306'), `all errors at once (${flags}): ${checked.stdout}`);
    }
    assert.equal((await payload.count({ collection: 'municipal-services', overrideAccess: true })).totalDocs, servicesBefore, 'nothing written');
    // Idempotente: si falta uno (como los 7 que no entraron en pruebas), al repetir solo se crea ese.
    await payload.delete({ collection: 'municipal-services', where: { externalID: { equals: 'ejemplo-lena-salud' } }, overrideAccess: true });
    const refill = await cli('servicios', 'docs/ejemplos/servicios-municipales.json');
    assert.ok(refill.stdout.includes('Creados 1 servicios municipales') && refill.stdout.includes('Ya existían 2'), refill.stdout);
    const again = await cli('servicios', 'docs/ejemplos/servicios-municipales.json');
    assert.ok(again.stdout.includes('Creados 0 servicios municipales') && again.stdout.includes('Ya existían 3'), 'repeatable');
    const stdin = await runCli(['scripts/util-run.mjs', 'rutas', '-', '--solo-comprobar'], JSON.stringify({ registros: [{ id: 'stdin-1', nombre: 'Por la entrada estándar', concejo: 'riosa' }] }));
    assert.ok(stdin.stdout.includes('Se crearían 1 rutas'), stdin.stdout);
    // Archivos reales de datos-servicios (commit bcc03e0 de desarrollo/planta14-contenido-ensayo), solo comprobación (sin descargas).
    for (const [kind, file] of [['patrimonio', 'patrimonio'], ['rutas', 'rutas'], ['servicios', 'servicios-municipales']]) {
      const real = spawnSync('git', ['show', `bcc03e0:datos-servicios/${file}.json`], { encoding: 'utf8', maxBuffer: 1 << 24 });
      if (real.status !== 0) { console.log(`AVISO: datos-servicios/${file}.json no está disponible; se omite su comprobación`); continue; }
      const result = await runCli(['scripts/util-run.mjs', kind, '-', '--solo-comprobar'], real.stdout);
      assert.ok(result.status === 0 && result.stdout.includes('COMPROBACIÓN TERMINADA'), `${file}: ${result.stdout}${result.stderr}`);
      console.log(`MEDIDA: datos-servicios/${file}.json: ${result.stdout.split('\n').filter(l => /^(Se crearían|No se importan|Ya existían)/.test(l)).join(' | ')}`);
    }
    passed('Útil importers validated against the real collection schema (lengths, required fields, select values; all errors at once, also with --solo-comprobar, nothing written); opening hours up to 500 characters; repeatable by id (only the missing records are created). Formats: npm run cms:patrimonio:importar, cms:rutas:importar and cms:servicios:importar (file or stdin, --solo-comprobar, --publicar); everything is validated first, an error imports nothing; repeatable by id; pharmacies are not imported (no reuse permission)');

    // El refresco del servidor llena la caché sin que nadie visite la web: lo arranca /api/health, que deploy.sh
    // consulta nada más desplegar (y luego el monitor).
    assert.equal((await fetch(`${web}/api/health`)).status, 200);
    const cacheKeys = ['dgt:pajares', 'bdns:abiertas', 'boe:empleo', ...['33037', '33033', '33002', '33038', '33058', '33057'].map(id => `aemet:${id}`)];
    await waitFor(async () => (await db(sql`SELECT count(*)::int AS n FROM external_cache WHERE fetched_at IS NOT NULL AND key IN ${cacheKeys}`)).rows[0].n === cacheKeys.length, 'server-side refresh filled the cache', 240);
    // Página del concejo: cada bloque automático con su atribución y su hora; el resto, enlaces a la fuente oficial.
    const lena = await page(`${web}/lena`);
    const block = (html, id) => html.split(`data-util="${id}"`)[1]?.split('</section>')[0] ?? '';
    assert.ok(lena.includes('data-municipal-util') && lena.includes('href="#util"') && !lena.includes('data-util="carreteras"'), 'Útil section on the concejo page');
    const winter = block(lena, 'invierno');
    const pajares = winter.split('data-util-pajares')[1].split('</div>')[0];
    assert.ok(pajares.includes('2 incidencias') && pajares.includes('N-630, km 85') && pajares.includes('Meteorología adversa · Nevada · Carretera cortada') && pajares.includes('Villamanín (León)')
      && !pajares.includes('km 10,') && !pajares.includes('km 200') && !/abierto/i.test(pajares), `Pajares from the DGT (N-630, Lena and Villamanín), never «abierto»: ${pajares}`);
    assert.ok(pajares.includes('Dirección General de Tráfico (DGT), Punto de Acceso Nacional') && pajares.includes('licencia CC BY') && pajares.includes('Parte de la DGT: <time') && pajares.includes('>04/11/2026, 21:00</time>') && pajares.includes('Consultado'), `DGT attribution, report time and download time: ${pajares}`);
    assert.ok(winter.includes('valgrande-pajares.com/parte-de-nieve-meteo') && !winter.includes('San Isidro') && !winter.includes('Fuentes de Invierno') && !winter.includes('AS-112'), 'Lena: Valgrande as a link only');
    const aller = await page(`${web}/aller`);
    assert.ok(block(aller, 'invierno').includes('112asturias.es/estado-carreteras') && block(aller, 'invierno').includes('fuentesdeinvierno.com') && !block(aller, 'invierno').includes('data-util-pajares')
      && !block(aller, 'invierno').includes('data-util-source'), 'Aller: San Isidro and Fuentes de Invierno as links only, no data');
    assert.ok(!(await page(`${web}/mieres`)).includes('data-util="invierno"'), 'no winter block where it does not apply');
    const weather = block(lena, 'tiempo');
    assert.ok(weather.includes('Nieve débil') && weather.includes('Cota de nieve 900 m') && weather.includes('Lluvia 80%') && weather.includes('9° / 1°')
      && weather.includes('© AEMET') && weather.includes('Información elaborada por la Agencia Estatal de Meteorología') && weather.includes('Elaborada: 04/11/2026 19:00'), `AEMET forecast (ISO-8859-15) with attribution: ${weather.slice(0, 900)}`);
    const grants = block(lena, 'subvenciones');
    assert.ok(grants.includes('Ayudas a la rehabilitación de fachadas en pola de lena 2026') && grants.includes('Solicitudes hasta el 01 de diciembre de 2099') && grants.includes('Hasta agotar el crédito')
      && grants.includes('data-util-grant="idepa"') && grants.includes('sede.asturias.es/ejemplo') && grants.includes('data-util-grant="estado"') && grants.includes('Ayudas estatales para la digitalización de pymes')
      && grants.includes('infosubvenciones.es/bdnstrans/GE/es/convocatorias/900001') && (grants.match(/convocatorias\/900001/g) ?? []).length === 1
      && !/GIJÓN|NOMINATIVA|ASOCIACIÓN VECINAL|TRANSPORTE ESCOLAR|ya cerradas/i.test(grants), `BDNS: open calls of Lena, Principado, IDEPA and the State: ${grants.slice(0, 1500)}`);
    assert.ok(grants.includes('idepa.es/busca-financiacion') && grants.includes('Base de Datos Nacional de Subvenciones') && grants.includes('avisolegal'), 'IDEPA link and BDNS attribution');
    const jobs = block(lena, 'empleo');
    assert.ok(jobs.includes('Ayuntamiento de Lena (Asturias)') && jobs.includes('Consejería de Salud') && !jobs.includes('Getafe') && jobs.includes('BOE-A-2026-90001')
      && jobs.includes('Agencia Estatal Boletín Oficial del Estado') && jobs.includes('el texto auténtico es el publicado en el BOE')
      && jobs.includes('miprincipado.asturias.es/bopa') && jobs.includes('aytolena.es/empleo-y-formacion') && !jobs.includes('mieres.es'), 'BOE with attribution; BOPA and the town hall as links');
    assert.ok(block(lena, 'farmacias').includes('farmasturias.org') && !block(lena, 'farmacias').includes('data-util-source'), 'pharmacies: link only');
    assert.ok(block(lena, 'patrimonio').includes('Santa Cristina de Lena') && block(lena, 'patrimonio').includes('class="util-thumb"') && !block(lena, 'patrimonio').includes('Bustiello'), 'heritage of the concejo, with its photo');
    assert.ok(block(await page(`${web}/mieres`), 'patrimonio').includes('data-util-neutral'), 'no photo: neutral design');
    assert.ok(block(lena, 'rutas').includes('Ruta de ejemplo en Lena') && block(lena, 'rutas').includes('Ruta de ejemplo en Aller'), 'routes of the concejo, also shared ones');
    const servicesBlock = block(lena, 'servicios');
    assert.ok(servicesBlock.includes('Ayuntamiento de Lena (EJEMPLO)') && servicesBlock.includes('tel:000000001') && servicesBlock.includes('000 00 00 02') && servicesBlock.includes('Cierre anunciado.')
      && !servicesBlock.includes('Biblioteca') && !servicesBlock.includes('Farmacia') && !servicesBlock.includes('Dudoso'), `municipal services directory of the concejo: ${servicesBlock}`);
    const hits = { ...state.hits };
    for (const path of ['/lena', '/util', '/aller', '/mieres', '/lena']) await page(`${web}${path}`);
    assert.deepEqual(state.hits, hits, 'visits never query the sources: they only read the server cache');
    // BDNS con 429: el refresco reintenta con espera, respeta Retry-After y reutiliza el detalle de cada convocatoria (24 h).
    const [searches, details] = [state.searches, state.details];
    state.bdns429 = 2;
    await db(sql`UPDATE external_cache SET fetched_at = now() - interval '7 hours' WHERE key = 'bdns:abiertas'`);
    await waitFor(async () => (await db(sql`SELECT fetched_at > now() - interval '1 minute' AND error IS NULL AS ok FROM external_cache WHERE key = 'bdns:abiertas'`)).rows[0].ok, 'BDNS refreshed after two 429');
    assert.equal(state.searches - searches, 4, 'two 429 retried, then both searches');
    assert.equal(state.details, details, 'details reused (no new detail requests within 24 hours)');
    assert.ok(/falla la fuente BDNS: subvenciones/.test(ctx.logs()) && /429/.test(ctx.logs()) && !ctx.logs().includes('clave-de-prueba'), 'errors logged with the source and the code, without the key');
    assert.ok(block(await page(`${web}/lena`), 'subvenciones').includes('900001'), 'grants still served');
    passed('BDNS and the other sources are only queried by the server-side refresh (BDNS at most every UTIL_BDNS_REFRESH_HOURS, 6 by default): visits only read the cache; 429/5xx retried with growing waits (Retry-After honoured), details reused for 24 hours, errors logged without personal data or keys');

    // /util general y fichas con mapa.
    const util = await page(`${web}/util`);
    assert.ok(block(util, 'invierno').includes('data-util-pajares') && block(util, 'invierno').includes('112asturias.es') && block(util, 'invierno').includes('valgrande-pajares.com') && block(util, 'invierno').includes('fuentesdeinvierno.com'), 'winter: Pajares and three links');
    assert.equal((block(util, 'tiempo').match(/data-util-forecast=/g) ?? []).length, 6, 'forecast for the six concejos');
    assert.ok(block(util, 'patrimonio').includes('Bustiello') && block(util, 'patrimonio').includes('Santa Cristina'), 'heritage of all concejos');
    assert.ok((block(util, 'empleo').match(/data-util-link/g) ?? []).length === 7, 'BOPA and the six town halls');
    const ficha = await page(`${web}/util/patrimonio/santa-cristina-de-lena-lena`);
    assert.ok(ficha.includes('data-util-photo') && ficha.includes('Autora de prueba / Wikimedia Commons / CC BY-SA 4.0') && ficha.includes(commons.paginaCommons) && ficha.includes('data-util-map="point"') && ficha.includes('mlat=43.128594') && ficha.includes('Segundo párrafo de ejemplo')
      && ficha.includes('Punto del mapa: EJEMPLO: punto aproximado') && ficha.includes('BIC, monumento · Decreto de prueba') && ficha.includes('turismoasturias.es'), `heritage card with OSM map and sources: ${ficha.slice(ficha.indexOf('data-util-place'), ficha.indexOf('data-util-place') + 2500)}`);
    const bustiello = await page(`${web}/util/patrimonio/poblado-minero-de-bustiello-mieres`);
    assert.ok(!bustiello.includes('duda interna') && bustiello.includes('data-util-neutral') && !bustiello.includes('data-util-map'), 'no coordinates: listed but not on the map; internal doubts are not public');
    const route = await page(`${web}/util/rutas/ruta-de-ejemplo-en-aller-aller`);
    assert.ok(route.includes('9,5 km (ida y vuelta, distancia total)') && route.includes('+450 m / −450 m') && route.includes('PR AS-00') && route.includes('También pasa por') && route.includes('Lena, Oviedo') && route.includes('Track GPX oficial') && route.includes('data-util-map="track"') && /data-track-points="(\d+)"/.test(route), 'route card');
    assert.ok(!(await page(`${web}/util/rutas?concejo=mieres`)).includes('Ruta de ejemplo'), 'routes filtered by concejo');
    assert.equal((await fetch(`${web}/util/patrimonio/no-existe`)).status, 404);
    // En el navegador: el recorrido se dibuja sobre OpenStreetMap; en el CMS, los avisos de revisión.
    const viewer = await browser.newContext();
    const mapTab = await viewer.newPage();
    await mapTab.goto(`${web}/util/rutas/gran-ruta-de-prueba-riosa`);
    await mapTab.locator('.util-map-canvas .leaflet-overlay-pane path').first().waitFor();
    assert.equal(await mapTab.locator('.util-map-canvas .leaflet-overlay-pane path.leaflet-interactive').count(), 2, 'GR 206: one line with two stages plus the start marker');
    assert.ok(await mapTab.locator('.leaflet-control-attribution').innerText().then(t => t.includes('colaboradores de OpenStreetMap')), 'OSM attribution');
    await viewer.close();
    const adminCookie = await signIn(users.admin.email);
    const cms = await browser.newContext();
    await cms.addCookies(adminCookie.split('; ').map(pair => { const [name, ...value] = pair.split('='); return { name, value: value.join('='), url: origin }; }));
    const edit = await cms.newPage();
    await edit.goto(`${origin}/cms/collections/heritage/${(await doc('heritage', 'fx-mieres-bustiello')).id}`);
    const notice = edit.locator('[data-util-review]');
    await notice.waitFor();
    const noticeText = await notice.innerText();
    assert.ok(noticeText.includes('Coordenadas pendientes') && noticeText.includes('Dudoso: revisar') && noticeText.includes('duda interna de prueba'), noticeText);
    await edit.goto(`${origin}/cms/collections/routes`);
    await edit.getByText('Dudoso y coordenadas pendientes').or(edit.getByText('Coordenadas pendientes')).first().waitFor();
    await cms.close();
    passed('Útil imports (datos-servicios bcc03e0 format): Commons photos into Imágenes with author and licence (neutral design without photo), «coordenadas pendientes» and «dudoso» warnings in the CMS, tracks drawn on OpenStreetMap from direct GPX, the official ZIP (no cycling variant) and WGS 84 PLT, otherwise only the official download link; repeatable without duplicates, filling in what failed before');
    passed('Útil on each concejo page and /util: only four automatic sources with their attribution and times (Pajares from the DGT, never «abierto»; AEMET per municipality; BDNS calls of the six town halls, the Principado, the IDEPA and the State, each linked to its official call, plus the IDEPA page; BOE jobs); San Isidro, Valgrande-Pajares, Fuentes de Invierno, pharmacies, BOPA and town hall jobs as links only; heritage and routes with an OSM map; municipal services; external queries cached');

    // Una fuente falla: la página sigue, se enseña el último dato con su hora y se avisa a la administración (una vez).
    state.boe = 'fail';
    await db(sql`UPDATE external_cache SET fetched_at = now() - interval '5 hours' WHERE key = 'boe:empleo'`);
    const mailsBefore = (await mails()).length;
    assert.ok(block(await page(`${web}/lena`), 'empleo').includes('Ayuntamiento de Lena'), 'stale data while the source is down');
    await waitFor(async () => (await mails()).length > mailsBefore, 'failure email');
    const alert = (await mails()).slice(mailsBefore).find(m => m.subject === 'Útil: no responde la fuente «BOE: oposiciones y concursos»');
    assert.ok(alert && alert.to.includes(users.admin.email) && alert.text.includes('HTTP 500') && alert.text.includes('sigue enseñando el último dato bueno'), 'email to the administration');
    const stale = block(await page(`${web}/lena`), 'empleo');
    assert.ok(stale.includes('data-util-stale') && stale.includes('Ayuntamiento de Lena'), 'marked as not updated now');
    await db(sql`UPDATE external_cache SET checked_at = now() - interval '1 hour' WHERE key = 'boe:empleo'`);
    await page(`${web}/lena`);
    await waitFor(async () => (await db(sql`SELECT checked_at > now() - interval '1 minute' AS fresh FROM external_cache WHERE key = 'boe:empleo'`)).rows[0].fresh, 'retried');
    assert.equal((await mails()).length, mailsBefore + 1, 'no second email within 12 hours');
    state.bdns = 'fail';
    await db(sql`DELETE FROM external_cache WHERE key = 'bdns:abiertas'`);
    await waitFor(async () => (await db(sql`SELECT count(*)::int AS n FROM external_cache WHERE key = 'bdns:abiertas' AND error IS NOT NULL`)).rows[0].n === 1, 'BDNS failure recorded');
    const down = await page(`${web}/lena`);
    assert.ok(block(down, 'subvenciones').includes('data-util-unavailable') && block(down, 'tiempo').includes('Nieve débil'), 'a source without data: notice in its block, the rest of the page works');
    await waitFor(async () => (await mails()).some(m => m.subject === 'Útil: no responde la fuente «BDNS: subvenciones»' && m.text.includes('ese bloque enseña un aviso')), 'second source email');
    state.boe = 'ok'; state.bdns = 'ok';
    await db(sql`UPDATE external_cache SET fetched_at = now() - interval '5 hours', checked_at = now() - interval '1 hour' WHERE key = 'boe:empleo'`);
    await page(`${web}/lena`);
    await waitFor(async () => (await db(sql`SELECT error IS NULL AS ok FROM external_cache WHERE key = 'boe:empleo'`)).rows[0].ok, 'recovered');
    passed('Útil sources failing: the page keeps working, shows the last good datum with its time (or a notice) and emails the administration at most once every 12 hours per source; it recovers on its own');

    // Directorio de servicios: el ayuntamiento edita el de su concejo; nadie más que la administración toca los demás.
    const mieresService = (await payload.find({ collection: 'municipal-services', where: { name: { equals: 'Biblioteca municipal (EJEMPLO)' } }, overrideAccess: true })).docs[0];
    const created = await fetch(`${web}/api/cms/municipal-services`, { method: 'POST', headers: as(lenaCookie), body: JSON.stringify({ name: 'Intento en Mieres', category: 'otros', town: mieresService.town }) });
    assert.equal(created.status, 201);
    const forced = (await created.json()).doc;
    assert.equal((await payload.findByID({ collection: 'municipal-services', id: forced.id, depth: 1, overrideAccess: true })).town.slug, 'lena', 'the server forces its own concejo');
    await payload.delete({ collection: 'municipal-services', id: forced.id, overrideAccess: true });
    assert.notEqual((await fetch(`${web}/api/cms/municipal-services/${mieresService.id}`, { method: 'PATCH', headers: as(lenaCookie), body: JSON.stringify({ name: 'Cambiado' }) })).status, 200, 'cannot edit another concejo');
    assert.notEqual((await fetch(`${web}/api/cms/municipal-services/${mieresService.id}`, { method: 'DELETE', headers: as(lenaCookie) })).status, 200, 'cannot delete another concejo');
    assert.equal((await fetch(`${web}/api/cms/municipal-services`, { method: 'POST', headers: as(editorCookie), body: JSON.stringify({ name: 'Redacción', category: 'otros', town: mieresService.town }) })).status, 403, 'journalists do not edit it');
    const panel = await browser.newContext();
    await panel.addCookies(lenaCookie.split('; ').map(pair => { const [name, ...value] = pair.split('='); return { name, value: value.join('='), url: origin }; }));
    const tab = await panel.newPage();
    await tab.goto(`${origin}/lena/panel`);
    const editor = tab.locator('[data-services-editor]');
    await editor.waitFor();
    assert.equal(await editor.locator('[data-service-row]').count(), 2, 'its two services');
    await editor.getByLabel('Nombre').fill('Punto limpio de Villallana');
    await editor.getByLabel('Tipo').selectOption('medio-ambiente');
    await editor.getByLabel('Teléfono').fill('985 49 00 00');
    await editor.getByRole('button', { name: 'Añadir al directorio ↗' }).click();
    await editor.getByText('Guardado. Ya sale en «Útil» de tu concejo.').waitFor();
    await editor.locator('[data-service-row]').nth(2).waitFor();
    await editor.locator('[data-service-row]').filter({ hasText: 'Centro de salud' }).getByRole('button', { name: 'Editar' }).click();
    await editor.getByLabel('Horario').fill('De 8:00 a 20:00');
    await editor.getByRole('button', { name: 'Guardar los cambios ↗' }).click();
    await editor.getByText('Guardado. Ya sale en «Útil» de tu concejo.').waitFor();
    await panel.close();
    const services = block(await page(`${web}/lena`), 'servicios');
    assert.ok(services.includes('Punto limpio de Villallana') && services.includes('tel:985490000') && services.includes('De 8:00 a 20:00'), 'published at once in Útil');
    passed('municipal services directory: each town hall edits its own from its panel (add, edit, remove; the server forces its concejo), the administration edits all, journalists and other town halls cannot');

    // Sin clave de AEMET el bloque del tiempo no sale.
    await stop(); await start({ ...sources, AEMET_API_KEY: '' });
    const noKey = await page(`${web}/lena`);
    assert.ok(!noKey.includes('data-util="tiempo"') && noKey.includes('data-util="subvenciones"'), 'no AEMET key: no weather block');
    passed('AEMET: with no AEMET_API_KEY in the .env the weather block is not shown');
  } finally {
    // Los bloques siguientes vuelven a fuentes inaccesibles: sin avisos por correo en 12 horas (no alteran sus cuentas de correos).
    await db(sql`UPDATE external_cache SET notified_at = now()`).catch(() => undefined);
    await stop(); await start();
    await new Promise(r => server.close(r));
  }
}
