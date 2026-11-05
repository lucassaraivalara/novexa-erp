import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

let vite, browser, url;
const assets = process.env.NOVEXA_TEST_ASSETS ?? '../docs/audits/assets/sprint23c';
before(async () => {
    const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';import {CssBaseline} from '@mui/material';import {BrowserRouter} from 'react-router-dom';import {ThemeModeProvider} from '/src/theme/ThemeModeProvider.tsx';import ContasPagar from '/src/pages/Financeiro/ContasPagar.tsx';createRoot(document.getElementById('root')).render(React.createElement(ThemeModeProvider,null,React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(ContasPagar))));`;
    vite = await createServer({ cacheDir:'node_modules/.vite-parciais', server:{host:'127.0.0.1',port:0,hmr:false}, plugins:[{
        name:'multiorigem-fixture', resolveId(id){if(id==='/multi.js')return '\0multi.js';}, load(id){if(id==='\0multi.js')return fixture;},
        configureServer(s){s.middlewares.use('/__multi',async(_,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__multi','<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/multi.js"></script>'));});}
    }] });
    await vite.listen();url=`http://127.0.0.1:${vite.httpServer.address().port}/__multi`;
    await mkdir(assets,{recursive:true});browser=await chromium.launch({headless:true});
});
after(async()=>{await browser?.close();await vite?.close();});

async function ambiente(t,{width=1366,height=768,theme='dark',falha=0,total=1245.87,saldo=1000,respostaEstornada=false}={}) {
    const page=await browser.newPage({viewport:{width,height}});t.after(()=>page.close());page.setDefaultTimeout(12000);
    const pagamentos=[],pedidos=[],requests=[],erros=[];let falhas=falha;
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
            if(falhas) {const f=falhas;falhas=0;if(f===-1)return route.abort('connectionfailed');return route.fulfill({status:f,headers,json:'Falha sintética. Revise a operação.'});}
            let pago=pagamentos.find(x=>x.chaveRequisicao===p.chaveRequisicao);
            if(!pago) {
                pago={id:100+pagamentos.length,contaPagarId:1,chaveRequisicao:p.chaveRequisicao,dataPagamento:p.dataPagamento,
                    valorOriginal:total,principalQuitado:Number(p.principalQuitado ?? conta.saldoPendente ?? total),juros:Number(p.juros),multa:Number(p.multa),desconto:Number(p.desconto),totalPago:Number(p.valorPago),
                    estado:'CONFIRMADO',usuarioNome:'Usuário sintético',dataCriacao:'2026-11-04T12:00:00',origens:p.origens.map((o,i)=>({pagamentoId:100+pagamentos.length,movimentoId:1000+pagamentos.length*10+i,contaFinanceiraId:o.contaFinanceiraId,contaFinanceiraNome:contas.find(c=>c.id===o.contaFinanceiraId).nome,valor:Number(o.valor),estornada:false}))};
                pagamentos.unshift(pago);for(const o of pago.origens)contas.find(c=>c.id===o.contaFinanceiraId).saldoAtual-=o.valor;
                const principal=(conta.principalQuitado??0)+pago.principalQuitado;conta={...conta,principalQuitado:principal,saldoPendente:Math.round((total-principal)*100)/100,status:principal>=total?'PAGA':'PARCIALMENTE_PAGA',pagamentoAtualId:pago.id,valorPago:(conta.valorPago??0)+pago.totalPago};
            }
            data=pago;
        } else if(path.endsWith('/estornar')) {
            const p=pagamentos.find(p=>p.id===Number(path.split('/').at(-2)));assert.ok(p);const {motivoEstorno}=req.postDataJSON();assert.ok(motivoEstorno);
            if(p.estado==='CONFIRMADO')for(const o of p.origens){contas.find(c=>c.id===o.contaFinanceiraId).saldoAtual+=o.valor;o.estornada=true;}
            Object.assign(p,{estado:'ESTORNADO',motivoEstorno,usuarioEstornoNome:'Usuário sintético',dataEstorno:'2026-11-04T13:00:00'});const ativos=pagamentos.filter(x=>x.estado==='CONFIRMADO'),principal=ativos.reduce((s,x)=>s+x.principalQuitado,0);conta={...conta,status:principal===0?'ABERTA':principal>=total?'PAGA':'PARCIALMENTE_PAGA',principalQuitado:principal,saldoPendente:Math.round((total-principal)*100)/100,valorPago:ativos.reduce((s,x)=>s+x.totalPago,0)};data=p;
        } else if(path.includes('/por-chave/')) {const pago=pagamentos.find(x=>x.chaveRequisicao===path.split('/').at(-1));return route.fulfill({status:pago?200:404,headers,json:pago??'not found'});}
        else if(path==='/financeiro/contas-pagar/1')data=conta;
        else if(path.endsWith('/pagamentos'))data={items:pagamentos,page:0,size:10,totalItems:pagamentos.length,totalPages:pagamentos.length?1:0};
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

async function parcial(modal,valor='500') {
    await modal.getByRole('combobox',{name:'Tipo de pagamento',exact:true}).click();
    await modal.page().getByRole('option',{name:'Pagamento parcial',exact:true}).click();
    await modal.getByRole('textbox',{name:'Principal a pagar agora (R$)',exact:true}).fill(valor);
}

for(const [width,height] of [[1366,768],[390,844]])test(`duas baixas, encargos e estorno anterior ${width}`,async t=>{
    const {page,modal,pedidos,pagamentos,erros}=await ambiente(t,{width,height});
    await parcial(modal);await modal.getByRole('textbox',{name:'Juros (R$)',exact:true}).fill('15');
    await modal.getByRole('textbox',{name:'Desconto (R$)',exact:true}).fill('5');await duas(modal);
    await expect(modal.getByText(/Saldo restante após pagamento:/)).toContainText('745,87');
    await expect(modal.getByRole('textbox',{name:'Valor da origem 2 (R$)',exact:true})).toHaveValue('210,00');
    assert.ok(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth));
    await page.screenshot({path:`${assets}/parcial-${width}.png`,animations:'disabled'});
    await modal.locator('.MuiDialogContent-root').evaluate(el=>el.scrollTop=0);
    await page.screenshot({path:`${assets}/principal-${width}.png`,animations:'disabled'});
    await modal.getByRole('button',{name:'Confirmar pagamento'}).click();await expect(modal).toHaveCount(0);
    assert.equal(pedidos[0].principalQuitado,'500.00');assert.equal(pedidos[0].valorPago,'510.00');
    await expect(page.getByText('Parcialmente paga',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Pagar conta',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'Pagar conta',exact:true}).click();const segundo=page.getByRole('dialog',{name:'Pagar conta'});
    await expect(segundo.getByRole('combobox',{name:'Tipo de pagamento',exact:true})).toHaveText('Quitar integralmente');
    await expect(segundo.getByRole('textbox',{name:'Valor da origem 1 (R$)',exact:true})).toHaveValue('745,87');
    await duas(segundo);await segundo.getByRole('textbox',{name:'Valor da origem 1 (R$)',exact:true}).fill('200');
    await segundo.getByRole('button',{name:'Usar restante'}).nth(1).click();
    await segundo.getByRole('button',{name:'Confirmar pagamento'}).click();await expect(segundo).toHaveCount(0);
    assert.equal(pedidos[1].principalQuitado,'745.87');assert.equal(pedidos[1].origens[1].valor,'545.87');
    assert.notEqual(pedidos[0].chaveRequisicao,pedidos[1].chaveRequisicao);
    await expect(page.getByRole('button',{name:'Pagar conta',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Consultar conta',exact:true}).click();
    await page.getByRole('button',{name:'Estornar baixa #100',exact:true}).click();
    const estorno=page.getByRole('dialog',{name:'Estornar baixa #100?'});
    await estorno.getByRole('textbox',{name:'Motivo do estorno'}).fill('Correção sintética da primeira baixa');
    await estorno.getByRole('button',{name:'Confirmar estorno'}).click();await expect(estorno).toHaveCount(0);
    assert.equal(pagamentos.find(p=>p.id===101).estado,'CONFIRMADO');assert.equal(pagamentos.find(p=>p.id===100).estado,'ESTORNADO');
    await expect(page.getByText('Estorno desta baixa #100',{exact:true})).toBeVisible();
    await expect(page.getByText(/Mais recentes pela data da baixa/)).toBeVisible();
    await expect(page.getByText(/Registrado por Usuário sintético/)).toHaveCount(2);
    await expect(page.getByText(/Principal já quitado:.*Saldo pendente:/)).toContainText('500,00');
    await page.screenshot({path:`${assets}/historico-${width}.png`,animations:'disabled'});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(erros,[]);
});

test('principal inválido não confirma; erro recuperável preserva principal e UUID',async t=>{
    const {modal,pedidos}=await ambiente(t,{falha:500});await parcial(modal,'2000');
    await expect(modal.getByRole('button',{name:'Confirmar pagamento'})).toBeDisabled();
    await modal.getByRole('textbox',{name:'Principal a pagar agora (R$)',exact:true}).fill('500');await escolher(modal,1,'Banco Inter');
    await modal.getByRole('button',{name:'Confirmar pagamento'}).click();
    await expect(modal.getByRole('textbox',{name:'Principal a pagar agora (R$)',exact:true})).toHaveValue('500,00');
    await modal.getByRole('button',{name:'Verificar pagamento'}).click();await expect(modal).toHaveCount(0);
    assert.equal(pedidos.length,2);assert.equal(pedidos[0].chaveRequisicao,pedidos[1].chaveRequisicao);
    assert.equal(pedidos[1].principalQuitado,'500.00');
});
