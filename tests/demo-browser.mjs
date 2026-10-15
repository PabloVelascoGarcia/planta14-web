// Run against a local production build. Playwright is supplied by the verification environment.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium, devices } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(path.join(process.env.PLAYWRIGHT_MODULE, 'index.mjs')).href : 'playwright');
const base = process.env.DEMO_TEST_URL || 'http://localhost:3014';
const output = process.env.DEMO_CAPTURES || path.resolve('captures');
(async () => {
  await fs.mkdir(output, {recursive:true});
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || undefined});
  const report = {pages:[],consoleErrors:[],brokenImages:[],overflow:[],links:[]};
  try {
    const desktop = await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
    const page = await desktop.newPage();
    page.on('pageerror', error => report.consoleErrors.push(error.message));
    const links = new Set();
    async function inspect(route, target=page, capture) {
      const response = await target.goto(base+route, {waitUntil:'networkidle'});
      assert.equal(response.status(),200,route);
      assert.match(response.headers()['x-robots-tag'], /noindex/);
      const text = await target.locator('body').innerText();
      assert.doesNotMatch(text, /La Voz de Asturias|Selección Planta 14|ASSA|contenido autorizado/i,route);
      const navigation = (await target.locator('nav').allInnerTexts()).join(' ');
      assert.doesNotMatch(navigation, /Langreo|Laviana|Sobrescobio|San Martín del Rey Aurelio|Caso/,route);
      await target.evaluate(async () => { await document.fonts.ready; for(const img of document.images) img.loading='eager'; await Promise.all(Array.from(document.images).map(img => img.complete ? Promise.resolve() : new Promise(resolve => {img.onload=resolve;img.onerror=resolve;setTimeout(resolve,15000)}))); });
      const broken = await target.locator('img').evaluateAll(imgs => imgs.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src));
      report.brokenImages.push(...broken.map(src=>({route,src})));
      const dimensions=await target.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
      if(dimensions.scroll>dimensions.width+1) report.overflow.push({route,...dimensions});
      for(const href of await target.locator('a[href]').evaluateAll(anchors=>anchors.map(a=>a.getAttribute('href')))) if(href.startsWith('/')) links.add(href.split('#')[0]);
      if(capture) await target.screenshot({path:path.join(output,capture),fullPage:true});
      report.pages.push({route,status:response.status(),viewport:dimensions.width,title:await target.title()});
    }
    await inspect('/',page,'portada-ordenador.png');
    await inspect('/aller',page,'aller-ordenador.png');
    for(const section of ['Avisos','Agenda','Ayudas y subvenciones','Tablón de anuncios','Contacto']) {
      await page.getByRole('button',{name:section,exact:true}).first().click();
      assert(await page.locator('.municipal-main-column').innerText(), section);
      assert(await page.locator('.municipal-main-column').getByRole('heading',{name:section,exact:true}).isVisible());
    }
    for(const town of ['mieres','lena','morcin','riosa','ribera-de-arriba']) await inspect('/'+town);
    await inspect('/aller/panel',page,'panel-ordenador.png');
    const mobile=await browser.newContext({...devices['iPhone 13'],defaultBrowserType:undefined});
    const phone=await mobile.newPage();phone.on('pageerror',error=>report.consoleErrors.push(error.message));
    await inspect('/',phone,'portada-movil.png');
    await inspect('/aller',phone,'aller-movil.png');
    await inspect('/aller/panel',phone,'panel-movil.png');
    await phone.getByLabel('Título',{exact:true}).fill('Aviso de prueba del navegador');
    await phone.getByLabel('Mostrar el aviso hasta').fill('2099-12-31');
    await phone.getByRole('button',{name:/Ver cómo queda/}).click();
    assert(await phone.locator('.municipal-live-preview').isVisible());
    await phone.getByRole('button',{name:'Publicar demostración ↗',exact:true}).click();
    assert.match(await phone.getByRole('status').innerText(), /ya se puede ver/);
    await phone.getByRole('link',{name:/Ver mi publicación/}).click();
    await phone.getByRole('button',{name:'Avisos',exact:true}).click();
    assert(await phone.locator('.municipal-main-column').getByRole('heading',{name:'Aviso de prueba del navegador'}).isVisible());
    await phone.reload();
    await phone.getByRole('button',{name:'Avisos',exact:true}).click();
    assert(await phone.locator('.municipal-main-column').getByRole('heading',{name:'Aviso de prueba del navegador'}).isVisible());
    await page.goto(base+'/aller');assert.equal(await page.getByText('Aviso de prueba del navegador',{exact:true}).count(),0);
    await phone.goto(base+'/aller/panel');
    await phone.getByText('Evento',{exact:true}).click();
    await phone.getByLabel('Título',{exact:true}).fill('Encuentro de prueba');
    await phone.getByLabel('Fecha del evento').fill('2099-12-31');
    await phone.getByRole('button',{name:'Publicar demostración ↗',exact:true}).click();
    await phone.getByRole('link',{name:/Ver mi publicación/}).click();
    await phone.getByRole('button',{name:'Agenda',exact:true}).click();
    assert(await phone.locator('.municipal-main-column').getByRole('heading',{name:'Encuentro de prueba'}).isVisible());
    await phone.goto(base+'/aller/panel');await phone.getByRole('button',{name:'Borrar mis publicaciones de prueba'}).click();
    await phone.goto(base+'/aller');assert.equal(await phone.getByText('Aviso de prueba del navegador',{exact:true}).count(),0);
    await phone.goto(base+'/aller/panel');
    await phone.evaluate(()=>localStorage.setItem('planta14:municipal-demo:v1:aller','{bad json'));
    await phone.goto(base+'/aller');assert(await phone.getByRole('heading',{name:'Noticias del concejo'}).isVisible());
    await phone.evaluate(()=>localStorage.clear());
    for(const route of links) {
      const response=await desktop.request.get(base+route);report.links.push({route,status:response.status()});
      assert(response.status()<400,`${route}: ${response.status()}`);
    }
    const robots=await desktop.request.get(base+'/robots.txt');assert.match(await robots.text(),/Disallow: \//);
    for(const route of ['/langreo','/laviana','/sobrescobio','/caso','/san-martin-del-rey-aurelio']) assert.equal((await desktop.request.get(base+route)).status(),404,route);
    assert.equal(report.consoleErrors.length,0,'Browser errors');assert.equal(report.overflow.length,0,'Horizontal overflow');
    assert.equal(report.brokenImages.length,0,'Broken images');
    report.result='passed';
  } catch(error) { report.result='failed';report.error=error.stack;process.exitCode=1; }
  finally { await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close(); }
})();
