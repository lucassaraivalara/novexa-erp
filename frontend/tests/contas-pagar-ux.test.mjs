import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

let vite, browser, url;
const assets = process.env.NOVEXA_TEST_ASSETS ?? '../docs/audits/assets/sprint23d';
before(async () => {
    const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';import {CssBaseline} from '@mui/material';import {BrowserRouter} from 'react-router-dom';import {ThemeModeProvider} from '/src/theme/ThemeModeProvider.tsx';import ContasPagar from '/src/pages/Financeiro/ContasPagar.tsx';createRoot(document.getElementById('root')).render(React.createElement(ThemeModeProvider,null,React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(ContasPagar))));`;
    vite = await createServer({ cacheDir:'node_modules/.vite-23d', server:{host:'127.0.0.1',port:0,hmr:false}, plugins:[{
        name:'multiorigem-fixture', resolveId(id){if(id==='/multi.js')return '\0multi.js';}, load(id){if(id==='\0multi.js')return fixture;},
        configureServer(s){s.middlewares.use('/__multi',async(_,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__multi','<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/multi.js"></script>'));});}
    }] });
    await vite.listen();url=`http://127.0.0.1:${vite.httpServer.address().port}/__multi`;
    await mkdir(assets,{recursive:true});browser=await chromium.launch({headless:true});
});
after(async()=>{await browser?.close();await vite?.close();});

async function ambiente(t,{width=1366,height=768,theme='dark',falha=0,total=1245.87,saldo=1000,respostaEstornada=false,resumoStatus=200,resumoDelay=0,auxStatus=200,contaInicial={},abrirModal=true}={}) {
    const page=await browser.newPage({viewport:{width,height}});t.after(()=>page.close());page.setDefaultTimeout(12000);
    const pagamentos=[],pedidos=[],requests=[],erros=[];let falhas=falha;
    const contas=[{id:10,nome:'Caixa financeiro',tipo:'CAIXA',saldoAtual:saldo,ativo:true},
        {id:20,nome:'Banco Inter sintético',tipo:'BANCO',saldoAtual:1000,ativo:true},
        {id:30,nome:'Terceira origem',tipo:'COFRE',saldoAtual:1000,ativo:true},
        {id:40,nome:'Inativa',tipo:'BANCO',saldoAtual:1000,ativo:false},{id:50,nome:'Adquirente legado',tipo:'ADQUIRENTE',saldoAtual:1000,ativo:true}];
    let conta={id:1,descricao:'Compra Bebidas — dados sintéticos',valor:total,status:'ABERTA',dataVencimento:'2026-11-10',valorPago:null,documento:null,fornecedorNome:'Fornecedor sintético',categoria:null,...contaInicial};
    page.on('pageerror',e=>erros.push(e.message));
    await page.addInitScript(mode=>{localStorage.setItem('novexa-theme-choice',mode);localStorage.setItem('novexa-auth',JSON.stringify({token:'fixture',perfil:'ADMIN',empresa:{id:1}}));},theme);
    await page.route('http://localhost:8080/**',async route=>{
        const req=route.request(),path=new URL(req.url()).pathname;
        const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
        if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
        requests.push({url:path,method:req.method()});if(path.endsWith('/resumo')&&resumoDelay)await new Promise(r=>setTimeout(r,resumoDelay));if(path.endsWith('/categorias')&&auxStatus!==200)return route.fulfill({status:auxStatus,headers,json:'Falha auxiliar'});if(path.endsWith('/resumo')&&resumoStatus!==200)return route.fulfill({status:resumoStatus,headers,json:'Falha no resumo'});let data=[];
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
        else if(path.endsWith('/resumo'))data=Object.fromEntries(['vencidas','seteDias','trintaDias','emAberto','pagasMes'].map(k=>[k,{total:k==='pagasMes'?conta.valorPago??0:0,quantidade:k==='pagasMes'?(pagamentos.filter(p=>p.estado==='CONFIRMADO').length):0}]));
        await route.fulfill({status:200,headers,json:data});
    });
    await page.goto(url);if(abrirModal)await page.getByRole('button',{name:'Pagar conta',exact:true}).click();
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


test('grid: colunas, ações, permissões e detalhes preservados',async t=>{
 const {page,requests,erros}=await ambiente(t,{abrirModal:false,contaInicial:{categoria:'Mercadorias',dataEmissao:'2026-10-01'}});
 await expect(page.getByRole('columnheader')).toHaveText(['Fornecedor','Documento','Descrição','Vencimento','Status','Saldo pendente','Valor original','Desembolsado','Ações']);
 const acoes=page.getByRole('row').filter({has:page.getByRole('button',{name:'Pagar conta',exact:true})}).getByRole('button');
 await expect(acoes).toHaveCount(4);await expect(acoes.first()).toHaveAttribute('aria-label','Pagar conta');
 await expect(page.getByRole('button',{name:'Editar conta aberta',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Mais ações da conta #1',exact:true}).click();
 const menu=page.getByRole('menu',{name:'Ações secundárias da conta'});
 await expect(menu.getByRole('menuitem')).toHaveCount(2);
 await expect(menu.getByRole('menuitem',{name:'Estornar pagamento',exact:true})).toBeDisabled();
 await menu.getByRole('menuitem',{name:/Cancelar conta/}).click();
 await expect(page.getByRole('dialog',{name:'Cancelar conta?'})).toBeVisible();
 assert.equal(requests.filter(r=>r.method==='POST').length,0);
 await page.getByRole('button',{name:'Voltar',exact:true}).click();
 await page.getByRole('button',{name:'Mais ações da conta #1',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(menu).toBeVisible();await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'Mais ações da conta #1',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Consultar conta',exact:true}).click();
 await expect(page.getByText(/Categoria: Mercadorias/)).toBeVisible();
 await expect(page.getByText('Emissão: 01/10/2026',{exact:true})).toBeVisible();
 assert.deepEqual(erros,[]);
});

for(const situacao of ['PARCIALMENTE_PAGA','PAGA','CANCELADA','GERADA'])test(`grid: ações permitidas ${situacao}`,async t=>{
 const {page}=await ambiente(t,{abrirModal:false,contaInicial:situacao==='GERADA'?{origemVinculoEntrada:'GERADA',entradaMercadoriaId:12}:{status:situacao,principalQuitado:situacao==='PAGA'?1245.87:situacao==='PARCIALMENTE_PAGA'?500:0,saldoPendente:situacao==='PAGA'?0:situacao==='PARCIALMENTE_PAGA'?745.87:1245.87}});
 await expect(page.getByRole('button',{name:'Pagar conta',exact:true})).toHaveCount(situacao==='PARCIALMENTE_PAGA'||situacao==='GERADA'?1:0);
 const editar=page.getByRole('button',{name:'Editar conta aberta',exact:true});
 if(situacao==='GERADA')await expect(editar).toBeEnabled();else await expect(editar).toBeDisabled();
 await page.getByRole('button',{name:'Mais ações da conta #1',exact:true}).click();
 await expect(page.getByRole('menuitem',{name:/Cancelar conta/})).toBeDisabled();
 const estornar=page.getByRole('menuitem',{name:'Estornar pagamento',exact:true});
 if(situacao==='PAGA'||situacao==='PARCIALMENTE_PAGA')await expect(estornar).toBeEnabled();else await expect(estornar).toBeDisabled();
});

test('grid: estorno no menu mantém seleção explícita da baixa',async t=>{
 const {page,modal,requests}=await ambiente(t);
 await modal.getByRole('combobox',{name:'Tipo de pagamento',exact:true}).click();await page.getByRole('option',{name:'Pagamento parcial',exact:true}).click();
 await modal.getByRole('textbox',{name:'Principal a pagar agora (R$)',exact:true}).fill('500');await escolher(modal,1,'Banco Inter');
 await modal.getByRole('button',{name:'Confirmar pagamento'}).click();await expect(modal).toHaveCount(0);
 const antes=requests.filter(r=>r.method==='POST').length;
 await page.getByRole('button',{name:'Mais ações da conta #1',exact:true}).click();
 await page.getByRole('menuitem',{name:'Estornar pagamento',exact:true}).click();
 await expect(page.getByRole('button',{name:'Estornar baixa #100',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Estornar baixa #100',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Estornar baixa #100?'})).toBeVisible();
 assert.equal(requests.filter(r=>r.method==='POST').length,antes);
});

test('grid: paginação preserva consulta e retorna à primeira página ao mudar tamanho',async t=>{
 const {page}=await ambiente(t,{abrirModal:false});const consultas=[];
 await page.route('**/financeiro/contas-pagar?**',r=>{const u=new URL(r.request().url());consultas.push(u.searchParams);return r.fulfill({json:{items:[{id:2,descricao:'Outra conta',status:'ABERTA',valor:50,dataVencimento:'2026-11-10'}],page:Number(u.searchParams.get('page')),size:Number(u.searchParams.get('size')),totalItems:61,totalPages:7}});});
 const tamanho=page.getByRole('combobox',{name:'Itens por página',exact:true});
 await tamanho.click();await page.getByRole('option',{name:'10',exact:true}).click();
 await expect(page.getByText('1–10 de 61',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Próxima página',exact:true}).click();await expect(page.getByText('11–20 de 61',{exact:true})).toBeVisible();
 assert.equal(consultas.at(-1).get('page'),'1');assert.equal(consultas.at(-1).get('size'),'10');
 await tamanho.click();await page.getByRole('option',{name:'25',exact:true}).click();await expect(page.getByText('1–25 de 61',{exact:true})).toBeVisible();
 assert.equal(consultas.at(-1).get('page'),'0');assert.equal(consultas.at(-1).get('size'),'25');
});

test('valores, filtros progressivos e resumo global',async t=>{
 const {page,modal,requests}=await ambiente(t);await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
 await expect(page.getByRole('columnheader',{name:'Pagamento',exact:true})).toHaveCount(0);
 const acoes=page.getByRole('row').filter({has:page.getByRole('button',{name:'Pagar conta',exact:true})}).getByRole('button');
 await expect(acoes.first()).toHaveAttribute('aria-label','Pagar conta');
 for(const name of ['Descrição','Valor original','Desembolsado','Saldo pendente'])await expect(page.getByRole('columnheader',{name,exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Mais filtros',exact:false}).click();
 await page.getByRole('combobox',{name:'Categoria',exact:true}).click();await page.getByRole('option',{name:'Todas',exact:true}).click();
 await page.getByRole('textbox',{name:'Emissão de',exact:true}).fill('2026-10-01');
 await page.getByRole('button',{name:'Mais filtros',exact:false}).click();
 await expect(page.getByRole('button',{name:'Mais filtros',exact:false})).toContainText('ativos');
 await expect(page.getByRole('textbox',{name:'Emissão de',exact:true})).not.toBeVisible();
 await expect(page.getByText(/Resumo global da empresa/)).toBeVisible();
 assert.equal(requests.filter(r=>r.url.endsWith('/resumo')).length,1);
 await page.getByRole('button',{name:'Limpar filtros'}).click();await expect(page.getByRole('button',{name:'Mais filtros',exact:false})).not.toContainText('ativos');
});
test('falha do resumo não vira zero e retry só consulta indicadores',async t=>{
 const {page,modal,requests}=await ambiente(t,{resumoStatus:500});await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
 await expect(page.getByText('Indisponível',{exact:true})).toHaveCount(5);
 const before=requests.length;
 await page.route('**/financeiro/contas-pagar/resumo',r=>r.fulfill({json:Object.fromEntries(['vencidas','seteDias','trintaDias','emAberto','pagasMes'].map(k=>[k,{total:0,quantidade:0}]))}));
 await page.getByRole('button',{name:'Tentar indicadores novamente'}).click();await expect(page.getByText('Sem movimento',{exact:true})).toHaveCount(5);
 assert.equal(requests.length,before);
});

for(const [width,height] of [[1366,768],[390,844]])test(`selecao explicita e apresentacao ${width}`,async t=>{
 const {page,modal,requests}=await ambiente(t,{width,height});
 await modal.getByRole('combobox',{name:'Tipo de pagamento',exact:true}).click();await page.getByRole('option',{name:'Pagamento parcial',exact:true}).click();
 await modal.getByRole('textbox',{name:'Principal a pagar agora (R$)',exact:true}).fill('500');await escolher(modal,1,'Banco Inter');
 await modal.getByRole('button',{name:'Confirmar pagamento'}).click();await expect(modal).toHaveCount(0);
 await page.locator('.MuiTableContainer-root').evaluateAll(els=>els.forEach(el=>el.scrollLeft=0));
 await page.screenshot({path:`${assets}/lista-${width}.png`,animations:'disabled'});
 const antes=requests.filter(r=>r.method==='POST').length;
 await page.getByRole('button',{name:'Mais ações da conta #1',exact:true}).click();await page.getByRole('menuitem',{name:'Estornar pagamento',exact:true}).click();await expect(page.getByRole('button',{name:'Estornar baixa #100',exact:true})).toBeVisible();
 assert.equal(requests.filter(r=>r.method==='POST').length,antes);
 await page.screenshot({path:`${assets}/detalhe-${width}.png`,animations:'disabled'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:'Estornar baixa #100',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Estornar baixa #100?'})).toBeVisible();
});
test('loading e filtros rapidos descartam resultado antigo',async t=>{
 const {page,modal}=await ambiente(t);await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
 let iniciar;const iniciou=new Promise(r=>iniciar=r);
 await page.route('**/financeiro/contas-pagar?**',async r=>{
  const termo=new URL(r.request().url()).searchParams.get('busca');
  if(termo==='antiga'){iniciar();await new Promise(resolve=>setTimeout(resolve,1200));}
  try{await r.fulfill({json:{items:[{id:2,descricao:termo==='antiga'?'Resultado antigo':'Resultado atual',valor:1,status:'ABERTA',dataVencimento:'2026-11-10'}],totalItems:1,totalPages:1}});}catch{}
 });
 const busca=page.getByRole('textbox',{name:'Buscar'});await busca.fill('antiga');await iniciou;await busca.fill('nova');
 await expect(page.getByText('Resultado atual',{exact:true})).toBeVisible();await page.waitForTimeout(1300);
 await expect(page.getByText('Resultado antigo',{exact:true})).toHaveCount(0);
});

test('carregamento nao mostra zero e falha auxiliar preserva resumo',async t=>{
 const {page,modal}=await ambiente(t,{resumoDelay:2000,auxStatus:500});await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
 await expect(page.getByLabel('Consultando indicador')).toHaveCount(5);
 await expect(page.getByText('Sem movimento',{exact:true})).toHaveCount(5);
 await expect(page.getByText('Indisponível',{exact:true})).toHaveCount(0);
});

for(const [width,height] of [[1366,768],[390,844]])test(`23D.1 cadastro agrupado preserva campos e payload ${width}`,async t=>{
 const {page,modal}=await ambiente(t,{width,height});await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button',{name:'Nova conta',exact:true}).click();const drawer=page.locator('.MuiDrawer-paper');
 await expect(drawer.getByRole('heading',{name:'Identificação da despesa'})).toBeVisible();
 const descricao=drawer.getByRole('textbox',{name:'Descrição',exact:true}),documento=drawer.getByRole('textbox',{name:'Número do documento',exact:true});
 await descricao.fill('Despesa sintética 23D.1');await documento.fill('TEST-23D1');
 const a=await descricao.boundingBox(),b=await documento.boundingBox();
 assert.ok(width>600 ? b.x>a.x && Math.abs(b.y-a.y)<2 : b.y>a.y);
 await drawer.getByRole('textbox',{name:'Categoria',exact:true}).fill('Teste');
 await drawer.locator('input[name="dataEmissao"]').fill('2026-11-05');await drawer.locator('input[name="dataVencimento"]').fill('2026-11-10');
 await drawer.getByRole('textbox',{name:'Valor (R$)',exact:true}).fill('1245,87');
 await drawer.getByRole('textbox',{name:'Observação',exact:true}).fill('Somente fixture');
 await page.screenshot({path:`${assets}/cadastro-${width}.png`,animations:'disabled'});
 assert.ok(await drawer.evaluate(el=>el.scrollWidth<=el.clientWidth));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const enviou=page.waitForRequest(r=>new URL(r.url()).pathname==='/financeiro/contas-pagar' && r.method()==='POST');
 await drawer.getByRole('button',{name:'Salvar',exact:true}).click();const pedido=(await enviou).postDataJSON();
 assert.equal(pedido.valor,1245.87);assert.equal(pedido.descricao,'Despesa sintética 23D.1');
 assert.deepEqual(Object.keys(pedido).sort(),['descricao','documento','fornecedorId','categoria','dataEmissao','dataVencimento','valor','observacao'].sort());
 await expect(drawer).toHaveCount(0);
});

for(const [width,height] of [[1366,768],[390,844]])test(`23D.1 pagamento compacto preserva residual e origens ${width}`,async t=>{
 const {page,modal,pedidos}=await ambiente(t,{width,height});
 await modal.getByRole('combobox',{name:'Tipo de pagamento',exact:true}).click();await page.getByRole('option',{name:'Pagamento parcial',exact:true}).click();
 await modal.getByRole('textbox',{name:'Principal a pagar agora (R$)',exact:true}).fill('500');
 await modal.getByRole('textbox',{name:'Juros (R$)',exact:true}).fill('15');await modal.getByRole('textbox',{name:'Desconto (R$)',exact:true}).fill('5');await duas(modal);
 await expect(modal.getByText(/Saldo restante após pagamento:/)).toContainText('745,87');
 const valores=modal.getByRole('region',{name:'Valores do pagamento'}),origens=modal.getByRole('region',{name:'Origens financeiras'});
 const a=await valores.boundingBox(),b=await origens.boundingBox();assert.ok(width>900 ? b.x>a.x : b.y>a.y);
 await modal.locator('.MuiDialogContent-root').evaluate(el=>el.scrollTop=0);
 await page.screenshot({path:`${assets}/pagamento-${width}.png`,animations:'disabled'});
 await modal.getByRole('button',{name:'Confirmar pagamento',exact:true}).focus();await expect(modal.getByRole('button',{name:'Confirmar pagamento',exact:true})).toBeFocused();
 await modal.getByRole('button',{name:'Confirmar pagamento',exact:true}).click();await expect(modal).toHaveCount(0);
 assert.equal(pedidos[0].principalQuitado,'500.00');assert.equal(pedidos[0].valorPago,'510.00');assert.equal(pedidos[0].origens.length,2);
});
