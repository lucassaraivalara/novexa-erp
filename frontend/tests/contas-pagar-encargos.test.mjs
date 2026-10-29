import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

let vite, browser, url, calculos;
before(async () => {
    const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';import {CssBaseline} from '@mui/material';import {BrowserRouter} from 'react-router-dom';import {ThemeModeProvider} from '/src/theme/ThemeModeProvider.tsx';import ContasPagar from '/src/pages/Financeiro/ContasPagar.tsx';import Extrato from '/src/pages/Financeiro/ExtratoFinanceiroDrawer.tsx';const conteudo=location.search.includes('extrato')?React.createElement(Extrato,{conta:{id:10,nome:'Banco sintético',saldoAtual:339.12},onFechar:()=>{},onSaldoAlterado:()=>{}}):React.createElement(ContasPagar);createRoot(document.getElementById('root')).render(React.createElement(ThemeModeProvider,null,React.createElement(CssBaseline),React.createElement(BrowserRouter,null,conteudo)));`;
    vite = await createServer({ cacheDir:'node_modules/.vite-encargos', server:{host:'127.0.0.1',port:0,hmr:false}, plugins:[{
        name:'encargos-fixture', resolveId(id){if(id==='/encargos.js')return '\0encargos.js';}, load(id){if(id==='\0encargos.js')return fixture;},
        configureServer(s){s.middlewares.use('/__encargos',async(_,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__encargos','<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/encargos.js"></script>'));});}
    }] });
    await vite.listen(); url=`http://127.0.0.1:${vite.httpServer.address().port}/__encargos`;
    calculos=await vite.ssrLoadModule('/src/pages/Financeiro/contaPagarCalculos.ts');
    browser=await chromium.launch({headless:true});
});
after(async()=>{await browser?.close();await vite?.close();});

test('centavos exatos, desconto integral quitado e limites financeiros',()=>{
    assert.equal(calculos.calcularPagamento('645','15,88','0','0').valorPago,'660.88');
    assert.equal(calculos.calcularPagamento('645','0.1','0.2','0').valorPago,'645.30');
    assert.equal(calculos.calcularPagamento('645','15.88','7.25','3.13').valorPago,'665.00');
    for(const campos of [['645','-1','0','0'],['645','0.001','0','0'],['645','0','0','645'],['645','0','0','646'],['645','','0','0'],['99999999999999999','0','0','0']])assert.equal(calculos.calcularPagamento(...campos),null);
    assert.equal(calculos.emAberto({status:'PAGA',valor:645,valorPago:634.5}),0);
});

async function ambiente(t,{mobile=false,theme='light',erro=false,saldo=1000,extrato=false}={}) {
    const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}});t.after(()=>page.close());
    page.setDefaultTimeout(8000);
    const chamadas=[],erros=[];page.on('pageerror',e=>erros.push(e.message));
    let conta={id:1,descricao:'Compra sintética',valor:645,status:'ABERTA',dataVencimento:'2026-10-01',valorPago:null,documento:null,fornecedorNome:null,categoria:null};
    await page.addInitScript(mode=>{localStorage.setItem('novexa-theme-choice',mode);localStorage.setItem('novexa-auth',JSON.stringify({token:'fixture',perfil:'ADMIN',empresa:{id:1}}));},theme);
    await page.route('http://localhost:8080/**',async route=>{
        const req=route.request(),path=new URL(req.url()).pathname;
        const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
        if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
        let data=[];
        if(path.endsWith('/pagar')) {
            const p=req.postDataJSON();chamadas.push(p);
            assert.equal(p.empresaId,undefined); assert.equal(req.headers().authorization,'Bearer fixture');
            if(erro)return route.fulfill({status:500,headers,json:'Falha sintética, tente novamente.'});
            conta={...conta,status:'PAGA',valorPago:Number(p.valorPago),juros:Number(p.juros),multa:Number(p.multa),desconto:Number(p.desconto),movimentacaoFinanceiraId:42};data=conta;
        } else if(path==='/financeiro/movimentacoes-financeiras') data={items:[{id:42,contaFinanceiraId:10,tipo:'SAIDA',origem:'CONTAS_A_PAGAR',descricao:'Pagamento conta a pagar #1',valor:660.88,dataMovimento:'2026-10-29',observacao:'Original: 645.00; Juros: 15.88; Multa: 0.00; Desconto: 0.00',usuarioNome:'Sintético',estornada:true,motivoEstorno:'Estorno da baixa da conta a pagar #1',usuarioEstornoNome:'Sintético'}],page:0,size:10,totalItems:1,totalPages:1};
        else if(path==='/financeiro/contas-pagar')data={items:[conta],page:0,size:25,totalItems:1,totalPages:1};
        else if(path==='/financeiro/contas-financeiras')data=[{id:10,nome:'Banco sintético',tipo:'BANCO',ativo:true,saldoAtual:saldo}];
        else if(path.endsWith('/resumo'))data=Object.fromEntries(['vencidas','seteDias','trintaDias','emAberto','pagasMes'].map(k=>[k,{total:0,quantidade:0}]));
        await route.fulfill({status:200,headers,json:data});
    });
    await page.goto(url+(extrato?'?extrato=1':''));
    if(extrato)return {page,chamadas,erros};
    await page.getByRole('button',{name:'Pagar conta',exact:true}).click();
    await page.getByRole('combobox',{name:'Conta financeira'}).click();await page.getByRole('option',{name:/Banco sintético/}).click();
    return {page,chamadas,erros};
}

for(const theme of ['light','dark'])for(const mobile of [false,true])test(`modal discrimina e paga juros ${theme} ${mobile?'mobile':'desktop'}`,async t=>{
    const {page,chamadas,erros}=await ambiente(t,{theme,mobile});const modal=page.getByRole('dialog',{name:'Pagar conta'});
    await modal.getByRole('textbox',{name:'Juros (R$)',exact:true}).fill('15,88');
    await expect(modal.getByRole('status')).toContainText(/660,88/);
    await expect(modal.getByText(/Valor original:/)).toContainText(/645,00/);
    await modal.getByRole('textbox',{name:'Juros (R$)',exact:true}).blur();
    assert.ok(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth));
    await page.screenshot({path:`node_modules/encargos-${theme}-${mobile?'mobile':'desktop'}.png`,fullPage:true,animations:'disabled'});
    await modal.getByRole('button',{name:'Confirmar pagamento'}).click();await expect(modal).toHaveCount(0);
    assert.equal(chamadas.length,1);assert.deepEqual(chamadas[0],{contaFinanceiraId:10,dataPagamento:chamadas[0].dataPagamento,valorPago:'660.88',juros:'15.88',multa:'0.00',desconto:'0.00'});
    await page.getByRole('button',{name:'Consultar conta',exact:true}).click();
    await expect(page.getByText(/Juros:.*15,88/)).toBeVisible();await expect(page.getByText(/Total pago:.*660,88/)).toBeVisible();assert.deepEqual(erros,[]);
});

test('saldo considera encargos e desconto; total inválido bloqueia',async t=>{
    const {page,chamadas}=await ambiente(t,{saldo:650});const modal=page.getByRole('dialog',{name:'Pagar conta'});
    await modal.getByRole('textbox',{name:'Juros (R$)',exact:true}).fill('15,88');
    await expect(modal.getByRole('button',{name:'Confirmar pagamento'})).toBeDisabled();await expect(modal.getByRole('alert')).toContainText('Saldo insuficiente');
    await modal.getByRole('textbox',{name:'Desconto (R$)',exact:true}).fill('20');await expect(modal.getByRole('button',{name:'Confirmar pagamento'})).toBeEnabled();
    await modal.getByRole('textbox',{name:'Desconto (R$)',exact:true}).fill('700');await expect(modal.getByRole('button',{name:'Confirmar pagamento'})).toBeDisabled();assert.equal(chamadas.length,0);
});
test('falha preserva discriminação e impede sucesso falso',async t=>{
    const {page,chamadas}=await ambiente(t,{erro:true});const modal=page.getByRole('dialog',{name:'Pagar conta'});
    await modal.getByRole('textbox',{name:'Juros (R$)',exact:true}).fill('15,88');await modal.getByRole('button',{name:'Confirmar pagamento'}).click();
    await expect(modal.getByRole('alert')).toContainText('Falha sintética');await expect(modal.getByRole('textbox',{name:'Juros (R$)',exact:true})).toHaveValue('15,88');
    await expect(modal.getByRole('status')).toContainText(/660,88/);assert.equal(chamadas.length,1);
});

test('extrato conserva discriminação após estorno e bloqueia estorno genérico',async t=>{
    const {page}=await ambiente(t,{extrato:true});
    await expect(page.getByText('Original: 645.00; Juros: 15.88; Multa: 0.00; Desconto: 0.00')).toBeVisible();
    await expect(page.getByText('Estornada',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Estornar movimentação',exact:true})).toBeDisabled();
});
