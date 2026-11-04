// Executado somente pelo teste Java opt-in, com JWT e schema sintéticos descartáveis.
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

const api=process.env.NOVEXA_MULTI_URL, token=process.env.NOVEXA_MULTI_TOKEN;
const titulo=Number(process.env.NOVEXA_MULTI_TITULO), empresa=Number(process.env.NOVEXA_MULTI_EMPRESA);
assert.equal(process.env.NOVEXA_MULTI_DISPOSABLE,'true');assert.match(api??'',/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
assert.ok(token&&titulo&&empresa);
const assets='../docs/audits/assets/sprint23b';await mkdir(assets,{recursive:true});
const fixture=`import React from 'react';import {createRoot} from 'react-dom/client';import {CssBaseline} from '@mui/material';import {BrowserRouter} from 'react-router-dom';import {ThemeModeProvider} from '/src/theme/ThemeModeProvider.tsx';import ContasPagar from '/src/pages/Financeiro/ContasPagar.tsx';createRoot(document.getElementById('root')).render(React.createElement(ThemeModeProvider,null,React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(ContasPagar))));`;
const vite=await createServer({cacheDir:'node_modules/.vite-multi-http',define:{'import.meta.env.VITE_API_URL':JSON.stringify('/local-api')},
    server:{host:'127.0.0.1',port:0,hmr:false,proxy:{'/local-api':{target:api,changeOrigin:true,rewrite:p=>p.replace(/^\/local-api/,''),
        configure(proxy){proxy.on('proxyReq',(upstream,request)=>{if(request.headers.origin)upstream.setHeader('origin',api);});}}}},
    plugins:[{name:'multi-http',resolveId(id){if(id==='/multi-http.js')return '\0multi-http.js';},load(id){if(id==='\0multi-http.js')return fixture;},
    configureServer(s){s.middlewares.use('/__multi-http',async(_,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__multi-http','<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/multi-http.js"></script>'));});}}]});
let browser;const requests=[],errors=[];
try {
    await vite.listen();browser=await chromium.launch({headless:true});
    let perderResposta=true;const page=await browser.newPage({viewport:{width:1366,height:900}});page.setDefaultTimeout(20000);
    await page.addInitScript(({token,empresa})=>{localStorage.setItem('novexa-auth',JSON.stringify({token,perfil:'ADMIN',empresa:{id:empresa}}));localStorage.setItem('novexa-theme-choice','dark');},{token,empresa});
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/local-api/**',route=>{
        const r=route.request(),p=new URL(r.url()).pathname.replace('/local-api','');
        if(r.method()!=='GET')assert.ok(r.method()==='POST'&&(p===`/financeiro/contas-pagar/${titulo}/pagamentos`||new RegExp(`^/financeiro/contas-pagar/${titulo}/pagamentos/\\d+/estornar$`).test(p)),'Somente a fixture pode ser alterada');
        if(perderResposta&&r.method()==='POST'&&p===`/financeiro/contas-pagar/${titulo}/pagamentos`){perderResposta=false;return route.continue({headers:{...r.headers(),'X-Test-Drop-Reply':'yes'}});}
        return route.continue();
    });
    page.on('response',r=>{if(r.url().includes('/local-api/'))requests.push({path:new URL(r.url()).pathname.replace('/local-api',''),method:r.request().method(),status:r.status()});});
    await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__multi-http`);
    await page.getByRole('button',{name:'Pagar conta',exact:true}).click();const modal=page.getByRole('dialog',{name:'Pagar conta'});
    async function selecionar(n,nome){await modal.getByRole('combobox',{name:n===1?'Conta financeira':`Conta financeira ${n}`,exact:true}).click();await page.getByRole('option',{name:new RegExp(nome)}).click();}
    await selecionar(1,'Sintética');await modal.getByRole('button',{name:'Adicionar outra origem'}).click();await selecionar(2,'Banco sintético');
    await modal.getByRole('textbox',{name:'Valor da origem 1 (R$)',exact:true}).fill('300');await modal.getByRole('button',{name:'Usar restante'}).nth(1).click();
    await expect(modal.getByRole('textbox',{name:'Valor da origem 2 (R$)',exact:true})).toHaveValue('945,87');
    await modal.locator('.MuiDialogContent-root').evaluate(el=>el.scrollTop=el.scrollHeight);
    await page.screenshot({path:`${assets}/http-real-origens.png`,animations:'disabled'});
    const pagoPromise=page.waitForResponse(r=>r.url().endsWith(`/${titulo}/pagamentos`)&&r.request().method()==='POST');
    await modal.getByRole('button',{name:'Confirmar pagamento'}).click();const resposta=await pagoPromise;assert.equal(resposta.status(),503);
    await expect(modal.getByRole('alert')).toBeVisible();
    await modal.getByRole('textbox',{name:'Valor da origem 1 (R$)',exact:true}).fill('500');await modal.getByRole('button',{name:'Usar restante'}).nth(1).click();
    const consulta=page.waitForResponse(r=>r.url().includes('/pagamentos/por-chave/')&&r.request().method()==='GET');
    await modal.getByRole('button',{name:'Verificar pagamento'}).click();const confirmado=await consulta;assert.equal(confirmado.status(),200);const pago=await confirmado.json();
    assert.equal(requests.filter(r=>r.method==='POST'&&r.path.endsWith('/pagamentos')).length,1);
    assert.equal(pago.totalPago,1245.87);assert.equal(pago.principalQuitado,1245.87);assert.equal(pago.origens.length,2);
    await expect(modal).toHaveCount(0);await page.getByRole('button',{name:'Consultar conta',exact:true}).click();
    const history=page.getByRole('region',{name:'Histórico de pagamentos'});await expect(history.getByText(/Principal quitado:/)).toContainText('1.245,87');
    await page.screenshot({path:`${assets}/http-real-historico.png`,animations:'disabled'});await page.getByRole('button',{name:'Fechar',exact:true}).click();
    await page.getByRole('button',{name:'Estornar pagamento',exact:true}).click();const estorno=page.getByRole('dialog',{name:'Estornar pagamento?'});
    await estorno.getByRole('textbox',{name:'Motivo do estorno'}).fill('Validação sintética navegador e HTTP real');
    await estorno.getByRole('button',{name:'Estornar pagamento',exact:true}).click();await expect(estorno).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Pagar conta',exact:true})).toBeEnabled();
    assert.deepEqual(errors,[]);assert.equal(requests.filter(r=>r.status===503).length,1);assert.ok(requests.every(r=>r.status===200||r.status===503));
    await writeFile(`${assets}/http-real-browser.json`,JSON.stringify({environment:'PostgreSQL descartável, porta aleatória, schema e JWT sintéticos',requests,javascriptErrors:errors.length,totalPago:pago.totalPago,principalQuitado:pago.principalQuitado,origens:pago.origens.map(o=>({valor:o.valor,movimentoId:o.movimentoId})),estorno:'todas as origens; saldos e título conferidos também no teste Java'},null,2));
} finally {await browser?.close();await vite.close();}
