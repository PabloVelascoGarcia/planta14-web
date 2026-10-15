import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(path.join(process.env.PLAYWRIGHT_MODULE,'index.mjs')).href : 'playwright');
const base=process.env.DEMO_TEST_URL || 'http://localhost:3016';
const output=process.env.DEMO_CAPTURES || path.resolve('captures');
const towns=(process.env.DEMO_TOWNS || 'lena,mieres,morcin,riosa,ribera-de-arriba,aller').split(',');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || undefined});
const results=[];
try {
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:1,isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const town of towns) {
   const response=await page.goto(`${base}/${town}`,{waitUntil:'networkidle'});
   assert.equal(response.status(),200,town);assert.match(response.headers()['x-robots-tag'],/noindex/);
   assert(await page.locator('.aller-hero').isVisible(),`${town}: hero`);
   assert(await page.locator('.aller-crest').isVisible(),`${town}: crest`);
   assert.equal(await page.locator('.aller-discover a').count(),3);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${town}: overflow`);
   assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||!i.naturalWidth).length),0,`${town}: image`);
   assert.doesNotMatch(await page.locator('body').innerText(),/La Voz de Asturias|ASSA/);
   assert.doesNotMatch((await page.locator('nav').allInnerTexts()).join(' '),/Langreo|Laviana|Sobrescobio/);
   await page.screenshot({path:path.join(output,`${town}-${width}.png`),fullPage:true});
   await page.screenshot({path:path.join(output,`${town}-${width}-cabecera.png`),fullPage:false});
   for(const name of ['Avisos','Agenda','Ayudas y subvenciones','Tablón de anuncios','Contacto']) {
    await page.getByRole('button',{name,exact:true}).first().click();
    assert(await page.locator('.municipal-main-column').getByRole('heading',{name,exact:true}).isVisible());
   }
   await page.goto(`${base}/${town}/panel`,{waitUntil:'networkidle'});
   assert(await page.locator('.aller-crest').isVisible());
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:path.join(output,`${town}-panel-${width}.png`),fullPage:true});
   await page.getByLabel('Título',{exact:true}).fill(`Prueba municipal ${town}`);
   await page.getByLabel('Mostrar el aviso hasta').fill('2099-12-31');
   await page.getByRole('button',{name:'Publicar demostración ↗',exact:true}).click();
   await page.getByRole('link',{name:/Ver mi publicación/}).click();
   await page.getByRole('button',{name:'Avisos',exact:true}).click();
   assert(await page.locator('.municipal-main-column').getByRole('heading',{name:`Prueba municipal ${town}`,exact:true}).isVisible());
   await page.goto(`${base}/${town}/panel`);await page.getByRole('button',{name:'Borrar mis publicaciones de prueba'}).click();
   results.push({town,width,result:'passed'});
  }
  assert.equal(errors.length,0,errors.join('\n'));await context.close();
 }
 await fs.writeFile(path.join(output,'identity-verification.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));
} finally {await browser.close();}
