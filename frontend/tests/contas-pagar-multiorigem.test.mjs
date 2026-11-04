import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

let vite, browser, url;
const assets = '../docs/audits/assets/sprint23b';
before(async () => {
    const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';import {CssBaseline} from '@mui/material';import {BrowserRouter} from 'react-router-dom';import {ThemeModeProvider} from '/src/theme/ThemeModeProvider.tsx';import ContasPagar from '/src/pages/Financeiro/ContasPagar.tsx';createRoot(document.getElementById('root')).render(React.createElement(ThemeModeProvider,null,React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(ContasPagar))));`;
    vite = await createServer({ cacheDir:'node_modules/.vite-multiorigem', server:{host:'127.0.0.1',port:0,hmr:false}, plugins:[{
        name:'multiorigem-fixture', resolveId(id){if(id==='/multi.js')return '\0multi.js';}, load(id){if(id==='\0multi.js')return fixture;},
        configureServer(s){s.middlewares.use('/__multi',async(_,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__multi','<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/multi.js"></script>'));});}
    }] });
    await vite.listen();url=`http://127.0.0.1:${vite.httpServer.address().port}/__multi`;
    await mkdir(assets,{recursive:true});browser=await chromium.launch({headless:true});
});
after(async()=>{await browser?.close();await vite?.close();});

async function ambiente(t,{width=1366,height=768,theme='dark',falha=0,total=1245.87,saldo=1000,respostaEstornada=false,perderConfirmacao=false}={}) {
    const page=await browser.newPage({viewport:{width,height}});t.after(()=>page.close());page.setDefaultTimeout(12000);
    const pagamentos=[],pedidos=[],requests=[],erros=[];const falhas=Array.isArray(falha)?[...falha]:falha?[falha]:[];
    const contas=[{id:10,nome:'Caixa financeiro',tipo:'CAIXA',saldoAtual:saldo,ativo:true},
        {id:20,nome:'Banco Inter sintético',tipo:'BANCO',saldoAtual:1000,ativo:true},
        {id:30,nome:'Terceira origem',tipo:'COFRE',saldoAtual:1000,ativo:true},
        {id:40,nome:'Inativa',tipo:'BANCO',saldoAtual:1000,ativo:false},{id:50,nome:'Adquirente legado',tipo:'ADQUIRENTE',saldoAtual:1000,ativo:true}];
    let conta={id:1,descricao:'Compra Bebidas — dados sintéticos',valor:total,status:'ABERTA',dataVencimento:'2026-11-10',valorPago:null,documento:null,fornecedorNome:'Fornecedor sintético',categoria:null};
    page.on('pageerror',e=>erros.push(e.message));
    await page.addInitScript(mode=>{localStorage.setItem('novexa-theme-choice',mode);localStorage.setItem('novexa-auth',JSON.stringify({token:'fixture',perfil:'ADMIN',empresa:{id:1}}));},theme);
    await page.route('http://localhost:8080/**',async route=>{
        const req=route.request(),path=new URL(req.url()).pathname;
        const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
        if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
        requests.push({url:path,method:req.method()});let data=[];
        if(path.endsWith('/pagamentos') && req.method()==='POST') {
            const p=req.postDataJSON();pedidos.push(p);assert.equal(p.empresaId,undefined);assert.equal(req.headers().authorization,'Bearer fixture');
            if(respostaEstornada)return route.fulfill({status:200,headers,json:{estado:'ESTORNADO'}});
            if(falhas.length) {const f=falhas.shift();if(f===-1)return route.abort('connectionfailed');return route.fulfill({status:f,headers,json:'Falha sintética. Revise a operação.'});}
            let pago=pagamentos.find(x=>x.chaveRequisicao===p.chaveRequisicao);
            if(!pago) {
                pago={id:100+pagamentos.length,contaPagarId:1,chaveRequisicao:p.chaveRequisicao,dataPagamento:p.dataPagamento,
                    valorOriginal:total,principalQuitado:total,juros:Number(p.juros),multa:Number(p.multa),desconto:Number(p.desconto),totalPago:Number(p.valorPago),
                    estado:'CONFIRMADO',usuarioNome:'Usuário sintético',dataCriacao:'2026-11-04T12:00:00',origens:p.origens.map((o,i)=>({pagamentoId:100+pagamentos.length,movimentoId:1000+pagamentos.length*10+i,contaFinanceiraId:o.contaFinanceiraId,contaFinanceiraNome:contas.find(c=>c.id===o.contaFinanceiraId).nome,valor:Number(o.valor),estornada:false}))};
                pagamentos.unshift(pago);for(const o of pago.origens)contas.find(c=>c.id===o.contaFinanceiraId).saldoAtual-=o.valor;
                conta={...conta,status:'PAGA',pagamentoAtualId:pago.id,valorPago:pago.totalPago};
            }
            if(perderConfirmacao){perderConfirmacao=false;return route.fulfill({status:503,headers,json:'Resposta perdida após confirmação sintética.'});}
            data=pago;
        } else if(path.includes('/pagamentos/por-chave/')){const pago=pagamentos.find(p=>p.chaveRequisicao===path.split('/').at(-1));if(!pago)return route.fulfill({status:404,headers,json:'Ainda não localizado.'});data=pago;
        } else if(path.endsWith('/estornar')) {
            const p=pagamentos.find(p=>p.id===Number(path.split('/').at(-2)));assert.ok(p);const {motivoEstorno}=req.postDataJSON();assert.ok(motivoEstorno);
            if(p.estado==='CONFIRMADO')for(const o of p.origens){contas.find(c=>c.id===o.contaFinanceiraId).saldoAtual+=o.valor;o.estornada=true;}
            Object.assign(p,{estado:'ESTORNADO',motivoEstorno,usuarioEstornoNome:'Usuário sintético',dataEstorno:'2026-11-04T13:00:00'});conta={...conta,status:'ABERTA',valorPago:null};data=p;
        } else if(path.endsWith('/pagamentos'))data={items:pagamentos,page:0,size:10,totalItems:pagamentos.length,totalPages:pagamentos.length?1:0};
        else if(path==='/financeiro/contas-pagar')data={items:[conta],page:0,size:25,totalItems:1,totalPages:1};
        else if(path==='/financeiro/contas-financeiras')data=contas;
        else if(path.endsWith('/resumo'))data=Object.fromEntries(['vencidas','seteDias','trintaDias','emAberto','pagasMes'].map(k=>[k,{total:k==='pagasMes'?conta.valorPago??0:0,quantidade:conta.status==='PAGA'?1:0}]));
        await route.fulfill({status:200,headers,json:data});
    });
    await page.goto(url);await page.getByRole('button',{name:'Pagar conta',exact:true}).click();
    const modal=page.getByRole('dialog',{name:'Pagar conta'});
    return {page,modal,pedidos,pagamentos,requests,erros,contas};
}
async function escolher(modal,numero,nome) {
    await modal.getByRole('combobox',{name:numero===1?'Conta financeira':`Conta financeira ${numero}`,exact:true}).click();
    await modal.page().getByRole('option',{name:new RegExp(nome)}).click();
}
async function duas(modal) {
    await escolher(modal,1,'Caixa financeiro');await modal.getByRole('button',{name:'Adicionar outra origem'}).click();
    await escolher(modal,2,'Banco Inter');await modal.getByRole('textbox',{name:'Valor da origem 1 (R$)',exact:true}).fill('300');
    await modal.getByRole('button',{name:'Usar restante'}).nth(1).click();
}

for(const [width,height] of [[1920,1080],[1366,768],[768,1024],[390,844]])for(const theme of ['dark','light'])
test(`duas origens ${width} ${theme}: total, responsividade e histórico`,async t=>{
    const {page,modal,pedidos,erros,requests}=await ambiente(t,{width,height,theme});await duas(modal);
    await expect(modal.getByRole('textbox',{name:'Valor da origem 2 (R$)',exact:true})).toHaveValue('945,87');
    await expect(modal.getByText(/Falta distribuir:/)).toContainText('0,00');
    assert.ok(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await modal.locator('.MuiDialogContent-root').evaluate(el=>el.scrollTop=0);
    await page.screenshot({path:`${assets}/pagamento-${width}-${theme}.png`,fullPage:false,animations:'disabled'});
    await modal.locator('.MuiDialogContent-root').evaluate(el=>el.scrollTop=el.scrollHeight);
    await page.screenshot({path:`${assets}/origens-${width}-${theme}.png`,fullPage:false,animations:'disabled'});
    await modal.getByRole('button',{name:'Confirmar pagamento'}).click();await expect(modal).toHaveCount(0);
    assert.equal(pedidos.length,1);assert.deepEqual(pedidos[0].origens,[{contaFinanceiraId:10,valor:'300.00'},{contaFinanceiraId:20,valor:'945.87'}]);
    assert.match(pedidos[0].chaveRequisicao,/^[a-f0-9-]{36}$/);await expect(page.getByRole('button',{name:'Pagar conta',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'Consultar conta',exact:true}).click();
    const history=page.getByRole('region',{name:'Histórico de pagamentos'});await expect(history.getByText(/Principal quitado:/)).toContainText('1.245,87');
    await expect(history.getByText('Caixa financeiro:',{exact:false})).toContainText('300,00');await expect(history.getByText('Banco Inter sintético:',{exact:false})).toContainText('945,87');
    await page.screenshot({path:`${assets}/historico-${width}-${theme}.png`,fullPage:false,animations:'disabled'});
    assert.equal(requests.filter(r=>r.url.endsWith('/pagamentos')&&r.method==='GET').length,1);assert.deepEqual(erros,[]);
});

test('três origens, encargos, exclusão e origem única automática',async t=>{
    const {modal,page,pedidos}=await ambiente(t,{total:645});await duas(modal);
    await modal.getByRole('textbox',{name:'Juros (R$)',exact:true}).fill('15,88');await modal.getByRole('textbox',{name:'Multa (R$)',exact:true}).fill('7,25');
    await modal.getByRole('textbox',{name:'Desconto (R$)',exact:true}).fill('3,13');
    await modal.getByRole('button',{name:'Adicionar outra origem'}).click();await escolher(modal,3,'Terceira');
    await modal.getByRole('textbox',{name:'Valor da origem 1 (R$)',exact:true}).fill('200,01');await modal.getByRole('textbox',{name:'Valor da origem 2 (R$)',exact:true}).fill('300,02');
    await modal.getByRole('button',{name:'Usar restante'}).nth(2).click();await expect(modal.getByRole('textbox',{name:'Valor da origem 3 (R$)',exact:true})).toHaveValue('164,97');
    await modal.getByRole('button',{name:'Remover origem 3'}).click();await modal.getByRole('button',{name:'Remover origem 2'}).click();
    await expect(modal.getByRole('textbox',{name:'Valor da origem 1 (R$)',exact:true})).toHaveValue('665,00');
    await modal.getByRole('button',{name:'Confirmar pagamento'}).click();await expect(modal).toHaveCount(0);
    assert.deepEqual(pedidos[0].origens,[{contaFinanceiraId:10,valor:'665.00'}]);
    await page.getByRole('button',{name:'Estornar pagamento',exact:true}).click();const estorno=page.getByRole('dialog',{name:'Estornar pagamento?'});
    await expect(estorno.getByRole('button',{name:'Estornar pagamento',exact:true})).toBeDisabled();await estorno.getByRole('textbox',{name:'Motivo do estorno'}).fill('Conferência sintética');
    await estorno.getByRole('button',{name:'Estornar pagamento',exact:true}).click();await expect(estorno).toHaveCount(0);
    await page.getByRole('button',{name:'Pagar conta',exact:true}).click();await escolher(page.getByRole('dialog',{name:'Pagar conta'}),1,'Banco Inter');
    await page.getByRole('button',{name:'Confirmar pagamento',exact:true}).click();await expect(page.getByRole('dialog',{name:'Pagar conta'})).toHaveCount(0);
    assert.notEqual(pedidos[0].chaveRequisicao,pedidos[1].chaveRequisicao);
});

for(const falha of [-1,400,409,500])test(`falha ${falha}: dados preservados e retry seguro`,async t=>{
    const {modal,pedidos}=await ambiente(t,{falha});await duas(modal);await modal.getByRole('button',{name:'Confirmar pagamento'}).click();
    await expect(modal.getByRole('alert')).toBeVisible();await expect(modal.getByRole('textbox',{name:'Valor da origem 1 (R$)',exact:true})).toHaveValue('300,00');
    const incerto=falha===-1||falha===500;
    if(incerto){await expect(modal.getByRole('button',{name:'Cancelar',exact:true})).toBeDisabled();await expect(modal.getByRole('textbox',{name:'Juros (R$)',exact:true})).toBeEnabled();}
    await modal.getByRole('button',{name:incerto?'Verificar pagamento':'Confirmar pagamento',exact:true}).click();await expect(modal).toHaveCount(0);
    assert.equal(pedidos.length,2);assert.deepEqual(pedidos[0],pedidos[1]);
});

test('valida distribuição, duplicação, saldo e clique repetido',async t=>{
    const {modal,page,pedidos}=await ambiente(t);await duas(modal);
    await modal.getByRole('textbox',{name:'Valor da origem 1 (R$)',exact:true}).fill('0');await expect(modal.getByRole('button',{name:'Confirmar pagamento'})).toBeDisabled();
    await modal.getByRole('textbox',{name:'Valor da origem 1 (R$)',exact:true}).fill('1100');await expect(modal.getByRole('alert')).toContainText('Saldo insuficiente');
    await modal.getByRole('textbox',{name:'Valor da origem 1 (R$)',exact:true}).fill('300');
    await modal.getByRole('combobox',{name:'Conta financeira 2',exact:true}).click();await expect(page.getByRole('option',{name:/Caixa financeiro/})).toHaveAttribute('aria-disabled','true');await expect(page.getByRole('option',{name:/Adquirente legado|Inativa/})).toHaveCount(0);
    await page.keyboard.press('Escape');await modal.getByRole('button',{name:'Confirmar pagamento'}).evaluate(b=>{b.click();b.click();});
    await expect(modal).toHaveCount(0);assert.equal(pedidos.length,1);
    await writeFile(`${assets}/frontend-verificacao.json`,JSON.stringify({fixture:'sintética, API mockada; backend real validado separadamente',resolucoes:[[1920,1080],[1366,768],[768,1024],[390,844]],themes:['light','dark'],doubleSubmitRequests:pedidos.length},null,2));
});

test('confirma três origens sem repetir os encargos',async t=>{
    const {modal,pedidos}=await ambiente(t,{total:645});await duas(modal);
    await modal.getByRole('textbox',{name:'Juros (R$)',exact:true}).fill('15,88');
    await modal.getByRole('button',{name:'Adicionar outra origem'}).click();await escolher(modal,3,'Terceira');
    await modal.getByRole('textbox',{name:'Valor da origem 1 (R$)',exact:true}).fill('200,01');await modal.getByRole('textbox',{name:'Valor da origem 2 (R$)',exact:true}).fill('300,02');
    await modal.getByRole('button',{name:'Usar restante'}).nth(2).click();await modal.getByRole('button',{name:'Confirmar pagamento'}).click();await expect(modal).toHaveCount(0);
    assert.equal(pedidos[0].valorPago,'660.88');assert.equal(pedidos[0].juros,'15.88');assert.deepEqual(pedidos[0].origens.map(o=>o.valor),['200.01','300.02','160.85']);
});
test('replay de operação já estornada não anuncia novo pagamento',async t=>{
    const {page,modal,pedidos}=await ambiente(t,{respostaEstornada:true});await duas(modal);await modal.getByRole('button',{name:'Confirmar pagamento'}).click();await expect(modal).toHaveCount(0);
    await expect(page.getByText('Este pagamento já foi estornado. Nenhum novo débito foi realizado.')).toBeVisible();assert.equal(pedidos.length,1);
});
test('correção após rejeição definitiva inicia outra intenção com dados preservados',async t=>{
    const {modal,pedidos}=await ambiente(t,{falha:400});await duas(modal);await modal.getByRole('button',{name:'Confirmar pagamento'}).click();await expect(modal.getByRole('alert')).toBeVisible();
    await modal.getByRole('textbox',{name:'Juros (R$)',exact:true}).fill('1');await modal.getByRole('button',{name:'Usar restante'}).nth(1).click();
    await modal.getByRole('button',{name:'Confirmar pagamento'}).click();await expect(modal).toHaveCount(0);assert.notEqual(pedidos[0].chaveRequisicao,pedidos[1].chaveRequisicao);assert.equal(pedidos[1].origens[0].valor,'300.00');assert.equal(pedidos[1].valorPago,'1246.87');
});

test('23B.1: 500→409 permite corrigir e confirmar sem fechar e preserva intenção',async t=>{
 const {modal,pedidos}=await ambiente(t,{falha:[500,409]});await duas(modal);await modal.getByRole('button',{name:'Confirmar pagamento'}).click();
 await expect(modal.getByRole('alert')).toBeVisible();await modal.getByRole('textbox',{name:'Valor da origem 1 (R$)',exact:true}).fill('500');await modal.getByRole('button',{name:'Usar restante'}).nth(1).click();
 await modal.getByRole('button',{name:'Verificar pagamento'}).click();await expect(modal.getByRole('alert')).toBeVisible();
 await modal.getByRole('textbox',{name:'Valor da origem 1 (R$)',exact:true}).fill('400');await modal.getByRole('button',{name:'Usar restante'}).nth(1).click();
 await modal.getByRole('button',{name:'Verificar pagamento'}).click();await expect(modal).toHaveCount(0);
 assert.equal(pedidos.length,3);assert.equal(new Set(pedidos.map(p=>p.chaveRequisicao)).size,1);assert.equal(pedidos[2].origens[0].valor,'400.00');
});
test('23B.1: confirmação perdida impede aplicar alteração e recupera pagamento original',async t=>{
 const {page,modal,pedidos,contas}=await ambiente(t,{perderConfirmacao:true});await duas(modal);await modal.getByRole('button',{name:'Confirmar pagamento'}).click();await expect(modal.getByRole('alert')).toBeVisible();
 await modal.getByRole('textbox',{name:'Valor da origem 1 (R$)',exact:true}).fill('500');await modal.getByRole('button',{name:'Usar restante'}).nth(1).click();
 await modal.getByRole('button',{name:'Verificar pagamento'}).click();await expect(modal).toHaveCount(0);
 assert.equal(pedidos.length,1);assert.equal(contas[0].saldoAtual,700);assert.equal(contas[1].saldoAtual.toFixed(2),'54.13');
 await expect(page.getByText('Pagamento confirmado. Consulte no histórico as origens efetivamente debitadas.')).toBeVisible();
});
