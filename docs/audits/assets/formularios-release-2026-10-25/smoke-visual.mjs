import {chromium,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=process.env.RELEASE15D_ROOT,s=JSON.parse(await readFile(root+'/state.json','utf8'));
if(s.database!=='novexa_forms_test'||s.stopped||s.pgport===5432||s.apiport===8080||s.uiport===5173)throw new Error('Somente ambiente descartável 15D em portas próprias.');
const api=`http://127.0.0.1:${s.apiport}`,base=`http://127.0.0.1:${s.uiport}`;
const auth=await(await fetch(api+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cpf:'12345678909',senha:'formTeste123'})})).json();
const browser=await chromium.launch({headless:true}),records=[];await mkdir(root+'/visual',{recursive:true});
try{
 for(const theme of ['light','dark'])for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height},locale:'pt-BR'});
  await page.addInitScript(({auth,theme})=>{localStorage.setItem('novexa-auth',JSON.stringify(auth));localStorage.setItem('novexa-theme-choice',theme);},{auth,theme});
  await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort('blockedbyclient'));
  for(const [route,screen] of [['/financeiro/contas-pagar','pagar'],['/produtos','kit'],['/pdv','pdv']]){
   await page.goto(base+route);
   if(screen==='pagar')await page.getByRole('button',{name:'Nova conta',exact:true}).click();
   if(screen==='kit'){
    await page.getByRole('row').filter({hasText:'Kit 15D'}).getByRole('button',{name:'Editar produto',exact:true}).click();
    await page.getByRole('tab',{name:'Kit/Combo',exact:true}).click();
    await expect(page.getByLabel('Fator para KG',{exact:true})).toHaveValue('0,000004');
   }
   if(screen==='pdv'){
    const opening=page.getByRole('dialog',{name:'Abrir Caixa',exact:true});
    await page.waitForTimeout(600);
    if(await opening.isVisible()){await opening.getByRole('button',{name:'Confirmar abertura',exact:true}).click();await expect(opening).toBeHidden();}
    await page.keyboard.press('F5');await expect(page.getByRole('combobox',{name:'Buscar produto ou ler código de barras',exact:true})).toBeFocused();
   }
   await page.waitForTimeout(250);
   const path=`visual/${screen}-${name}-${theme}.png`;
   await page.screenshot({path:root+'/'+path,fullPage:true});
   const metrics=await page.evaluate(()=>{
    const elements=[...document.querySelectorAll('input:not([type=hidden]),textarea')].filter(e=>e.getClientRects().length&&e.getAttribute('aria-hidden')!=='true'&&!e.classList.contains('MuiSelect-nativeInput'));
    const missing=elements.filter(e=>!(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.labels?.length)).map(e=>({name:e.name,type:e.type}));
    return {bodyWidth:document.documentElement.scrollWidth,viewport:innerWidth,missingLabels:missing,fields:elements.length,dialogOverflow:[...document.querySelectorAll('[role=dialog]')].map(e=>({scroll:e.scrollWidth,width:e.clientWidth}))};
   });
   expect(metrics.bodyWidth).toBeLessThanOrEqual(width);expect(metrics.missingLabels).toEqual([]);
   for(const d of metrics.dialogOverflow)expect(d.scroll).toBeLessThanOrEqual(d.width+1);
   records.push({theme,viewport:name,screen,path,...metrics});
  }
  await page.close();
 }
}finally{await writeFile(root+'/visual-results.json',JSON.stringify(records,null,2));await browser.close();}
