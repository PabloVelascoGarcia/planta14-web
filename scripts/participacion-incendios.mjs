// Bloque «Índice de riesgo de incendios» de scripts/participacion-integration.mjs, con un 112 Asturias simulado:
// el servidor lee la página (las visitas solo leen la caché) y «Útil» muestra el nivel de cada concejo con su color y
// texto, la fecha del índice, la hora de consulta, la fuente con su licencia y el enlace oficial (resumen del concejo,
// /[concejo]/util y /util). Con un cambio de formato simulado, o un índice que no es de hoy, no sale ningún nivel: solo
// el enlace «Índice de riesgo de incendios (112 Asturias)».
import http from 'node:http';

export async function run(ctx) {
  const { payload, web, passed, assert, start, stop, page } = ctx;
  await ctx.activate(['lena', 'mieres']);
  const { sql } = await import('@payloadcms/db-postgres');
  const db = query => payload.db.drizzle.execute(query);
  const port = 59031, mock = `http://127.0.0.1:${port}`;
  const today = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  const yesterday = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(Date.now() - 86400_000));
  const state = { mode: 'ok', hits: 0 };
  const others = Array.from({ length: 72 }, (_, i) => `CONCEJO ${i + 1}`);
  const rows = [['indice_alto', '3', 'LENA'], ['indice_bajo', '1', 'MIERES'], ['indice_moderado', '2', 'ALLER'], ['indice_bajo', '1', 'MORC\xCDN'], ['indice_muy_alto', '4', 'RIOSA'], ['indice_sin_datos', '&nbsp;', 'RIBERA DE ARRIBA'], ...others.map(n => ['indice_bajo', '1', n])];
  const html = ({ date, list = 'lista_indices_concejos' }) => `<html><body><div id="fecha_incendios"><span class="fecha_incendios_actual">${date}</span></div>
    <ul class="${list}">${rows.map(([c, n, name]) => `<li><span class="${c}">${n}</span> ${name}</li>`).join('\n')}</ul></body></html>`;
  const server = http.createServer((req, res) => {
    state.hits++;
    const body = state.mode === 'ok' ? html({ date: today }) : state.mode === 'yesterday' ? html({ date: yesterday }) : html({ date: today, list: 'indices-por-concejo' });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=iso-8859-1' }); res.end(Buffer.from(body, 'latin1'));
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const fresh = async () => {
    await db(sql`DELETE FROM external_cache WHERE key = 'incendios:112'`);
    for (let i = 0; i < 120; i++) { const row = (await db(sql`SELECT fetched_at, error FROM external_cache WHERE key = 'incendios:112'`)).rows[0]; if (row && (row.error || row.fetched_at)) return row; await new Promise(r => setTimeout(r, 250)); }
    assert.fail('the server read the 112 page');
  };
  const pages = async () => ({ summary: await page(`${web}/lena`), town: await page(`${web}/lena/util`), all: await page(`${web}/util`) });
  try {
    await stop();
    await start({ UTIL_INCENDIOS_URL: `${mock}/indice-incendios-asturias`, UTIL_REFRESH_DISABLED: 'false', UTIL_REFRESH_START_SECONDS: '1', UTIL_REFRESH_CHECK_SECONDS: '1', UTIL_RETRY_BASE_MS: '100', UTIL_BACKOFF_BASE_MS: '1500' });
    // El refresco del servidor arranca con /api/health (como tras desplegar).
    await fetch(`${web}/api/health`);
    // 1. Lectura buena de hoy: nivel con color y texto, fecha, hora, fuente con licencia y enlace oficial.
    assert.equal((await fresh()).error, null);
    const before = state.hits;
    let p = await pages();
    assert.equal(state.hits, before, 'visits never query the 112 (cache only)');
    const official = 'href="https://www.112asturias.es/indice-incendios-asturias"';
    for (const [where, html] of [['summary', p.summary], ['/lena/util', p.town]]) {
      assert.ok(/data-fire-level="3"[^>]*>3 · Alto</.test(html) && html.includes(`Índice del ${today}`) && /consultado a las \d{2}:\d{2}/.test(html)
        && html.includes('112 Asturias · Servicio de Emergencias del Principado de Asturias (SEPA)') && html.includes('sin licencia de reutilización publicada') && html.includes(official), `${where}: Lena level 3 Alto with date, time, source, licence and link`);
    }
    assert.ok(/data-fire-town="aller"[\s\S]{0,200}2 · Moderado/.test(p.all) && /data-fire-town="riosa"[\s\S]{0,200}4 · Muy alto/.test(p.all) && /data-fire-town="ribera-de-arriba"[\s\S]{0,200}sin información/.test(p.all) && p.all.includes(official), '/util: every concejo (Ribera «sin información»)');
    if (process.env.PANEL_SHOTS_DIR) {
      const context = await ctx.browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
      const tab = await context.newPage();
      for (const [name, path, sel] of [['incendios-concejo', '/lena', '[data-util-summary]'], ['incendios-util-concejo', '/lena/util', '[data-util="incendios"]'], ['incendios-util', '/util', '[data-util-fire-strip]']]) {
        await tab.goto(`${ctx.origin}${path}`, { waitUntil: 'load' });
        await tab.locator(sel).first().screenshot({ path: `${process.env.PANEL_SHOTS_DIR}/${name}.png` });
      }
      await context.close();
    }
    // 2. Cambio de formato simulado: ningún nivel, solo el enlace.
    state.mode = 'formato';
    assert.ok((await fresh()).error, 'format change recorded as an error');
    p = await pages();
    for (const [where, html] of Object.entries(p)) assert.ok(!html.includes('data-fire-level') && html.includes('Índice de riesgo de incendios (112 Asturias)') && html.includes(official), `${where}: format change → only the link`);
    // 3. Índice que no es de hoy: tampoco.
    state.mode = 'yesterday';
    assert.equal((await fresh()).error, null);
    p = await pages();
    for (const [where, html] of Object.entries(p)) assert.ok(!html.includes('data-fire-level') && html.includes('Índice de riesgo de incendios (112 Asturias)'), `${where}: yesterday’s index → only the link`);
  } finally {
    await new Promise(r => server.close(r));
    await stop(); await start();
  }
  passed('fire risk index (112 Asturias, simulated): read by the server only (visits read the cache); level per concejo with colour and text, index date, time of the check, source with licence and official link in the concejo summary, /[concejo]/util and /util; a simulated format change or an index that is not from today shows no level, only «Índice de riesgo de incendios (112 Asturias)»');
}
