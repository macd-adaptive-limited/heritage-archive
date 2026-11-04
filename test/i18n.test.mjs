import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordPage, indexPage, notFoundPage, lineCropHtml, VIEWER_JS } from '../src/render.mjs';
const rec={id:'demo',nombre:'Source: Copy citation <x>',apellidos:'Example',edad:33,hogar:2,pagina:3,anio:1869,imagen:'img/demo.jpg',fuente:'Source: private <x>',confianza:'media',revisado:false,linea:{x:.1,y:.2,w:.5,h:.05,aspect:.75}};
for(const lang of ['es','es-ES','ES-mx'])test(`Spanish labels for ${lang}, without translating user data`,()=>{
 const site={lang,title:'Demo',subtitle:'Example',baseUrl:'https://example.invalid/colunga/'};
 const h=recordPage(rec,site);
 for(const expected of ['33 años','hogar 2','página 3','Copiar cita','revisar lectura','pendiente de revisión','Fuente:','Abrir la página original','en otra pestaña','Saltar al contenido','Recuadro detectado por IA'])assert.ok(h.includes(expected),expected);
 for(const en of ['33 years','household 2','page 3','>Copy citation<','not reviewed','check reading'])assert.ok(!h.includes(en),en);
 assert.ok(h.includes('Source: Copy citation &lt;x&gt;'));
 assert.ok(h.includes('Source: private &lt;x&gt;'));
 const i=indexPage(site,161);assert.ok(i.includes('161 asientos indexados.'));assert.ok(i.includes('Índice en revisión:'));assert.ok(i.includes('bundle-path="/colunga/pagefind/"'));
 assert.ok(notFoundPage(site).includes('Página no encontrada'));assert.ok(lineCropHtml(rec,site).includes('Recorte de la línea original'));
 assert.ok(recordPage({...rec,revisado:true},site).includes('>revisado</span>'));
});
test('English and unknown locales retain English labels and escaped data',()=>{
 for(const lang of ['en','en-IE','fr',undefined,'esperanto']){
  const h=recordPage(rec,{lang,title:'Demo'});
  for(const v of ['33 years','household 2','page 3','>Copy citation<','check reading','not reviewed','Source: private &lt;x&gt;'])assert.ok(h.includes(v),v);
  assert.ok(indexPage({lang},11).includes('11 entries indexed.'));
  assert.ok(notFoundPage({lang}).includes('Page not found'));
 }
});
test('viewer copy, fallback and language detection support Spanish without removing English',()=>{
 for(const v of ['Cita copiada.','Citation copied.','Cita para copiar','Citation to copy','No se ha podido cargar la imagen.','The page scan could not be loaded.'])assert.ok(VIEWER_JS.includes(v));
 assert.ok(VIEWER_JS.includes('document.documentElement.lang'));
});
test('age singular and plural are correct in Spanish and English',()=>{
 for(const [lang,one,many] of [['es','1 año','2 años'],['en','1 year','2 years']]){
  assert.ok(recordPage({...rec,edad:1},{lang}).includes(one));
  assert.ok(recordPage({...rec,edad:2},{lang}).includes(many));
 }
});
test('Spanish viewer tooltips, errors and gesture labels are set before viewer creation',()=>{
 for(const key of ['Tooltips.ZoomIn','Tooltips.ZoomOut','Tooltips.Home','Tooltips.FullPage','Tooltips.NextPage','Tooltips.PreviousPage','Tooltips.RotateLeft','Tooltips.RotateRight','Tooltips.Flip','GestureHints.Touch','GestureHints.Scroll','Errors.Dzc','Errors.Dzi','Errors.Xml','Errors.ImageFormat','Errors.Security','Errors.Status','Errors.OpenFailed'])assert.ok(VIEWER_JS.includes('"'+key+'"'),key);
 assert.ok(VIEWER_JS.indexOf('OpenSeadragon.setString')<VIEWER_JS.indexOf('const viewer = OpenSeadragon'));
 assert.ok(VIEWER_JS.includes('if (es)'));
});
