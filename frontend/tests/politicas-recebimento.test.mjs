import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
let vite, browser, url, modulo;
const resumo = { totaisPorConfiguracao: [
    { configuracaoId: 7, formaPagamentoId: 2, descricao: "PIX Nubank", tipo: "PIX", total: 30 },
    { configuracaoId: 8, formaPagamentoId: 2, descricao: "PIX Sicredi", tipo: "PIX", total: 10 },
    { configuracaoId: 9, formaPagamentoId: 3, descricao: "Débito InfinitePay", tipo: "DEBITO", total: 40 },
    { configuracaoId: 1, formaPagamentoId: 1, descricao: "Dinheiro", tipo: "DINHEIRO", total: 20 },
] };
const politica = { modo: "CONTROLADO", conferencia: "POR_FORMA_PAGAMENTO", exigirValoresInformadosNoFechamento: true };
const grupo = { dataPrevista: "2026-10-21", configuracaoId: 9, configuracaoNome: "Crédito InfinitePay", tipo: "CREDITO",
    contaDestinoId: 3, contaDestinoNome: "Banco Inter", quantidade: 2, bruto: 100, taxas: 3, liquido: 97, semPrevisaoLiquida: 0 };
const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { createNovexaTheme } from '/src/theme/theme.ts';
import Config from '/src/pages/Configuracoes/ConfiguracaoRecebimentos.tsx';
import Agenda from '/src/pages/Financeiro/AgendaRecebimentos.tsx';
import Conferencia from '/src/pages/Financeiro/ConferenciaMeiosPagamento.tsx';
import { conferenciaMeios } from '/src/pages/Financeiro/conferenciaMeios.ts';
function Fixture() {
    const params=new URLSearchParams(location.search), [valores,setValores]=React.useState({}), [total,setTotal]=React.useState('');
    const policy={...${JSON.stringify(politica)},...(params.has('total')?{conferencia:'TOTAL'}:{})};
    const tela=params.get('tela');
    const modo=params.get('tema')==='auto'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):params.get('tema')||'light';
    return React.createElement(ThemeProvider,{theme:createNovexaTheme(modo)},React.createElement(CssBaseline),React.createElement(BrowserRouter,null,
        tela==='agenda'?React.createElement(Agenda,{onFechar:()=>{},onAlterado:()=>{}}):tela==='conferencia'?React.createElement(Conferencia,{
            politica:policy,conferencia:conferenciaMeios(${JSON.stringify(resumo)},policy,valores,total),valores,total,
            onValor:(chave,valor)=>setValores(v=>({...v,[chave]:valor})),onTotal:setTotal,disabled:false}):React.createElement(Config)));
}
createRoot(document.getElementById('root')).render(React.createElement(Fixture));
`;
before(async () => {
    vite=await createServer({ cacheDir:"node_modules/.vite-politicas-tests",server:{host:"127.0.0.1",port:0,hmr:false},plugins:[{
        name:"politicas-fixture",resolveId(id){if(id==='/politicas.js')return '\0politicas.js';},load(id){if(id==='\0politicas.js')return fixture;},
        configureServer(s){s.middlewares.use('/__politicas',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__politicas','<div id="root"></div><script type="module" src="/politicas.js"></script>'));});}
    }] });
    await vite.listen();url=`http://127.0.0.1:${vite.httpServer.address().port}/__politicas`;browser=await chromium.launch({headless:true});
    modulo=await vite.ssrLoadModule('/src/pages/Financeiro/conferenciaMeios.ts');
});
after(async()=>{await browser?.close();await vite?.close();});
async function ambiente(t,op={}) {
    const page=await browser.newPage({viewport:op.viewport??{width:1280,height:800},colorScheme:'dark'});t.after(()=>page.close());
    const chamadas=[],erros=[];page.on('pageerror',e=>erros.push(e.message));
    await page.addInitScript(perfil=>localStorage.setItem('novexa-auth',JSON.stringify({token:'fixture',perfil,empresa:{id:1}})),op.perfil??'ADMIN');
    await page.route('**/financeiro/**',async route=>{
        const r=route.request(),path=new URL(r.url()).pathname;const headers={'access-control-allow-origin':'*','access-control-allow-methods':'*','access-control-allow-headers':'*'};
        if(r.method()==='OPTIONS')return route.fulfill({status:204,headers});
        chamadas.push({path,method:r.method(),dados:r.method()==='GET'?null:r.postDataJSON()});
        let dados={...politica,modo:op.controlado?'CONTROLADO':'SIMPLIFICADO'},status=200;
        if(path.endsWith('/agenda'))dados={items:op.vazio?[]:[grupo],page:0,size:25,totalItems:op.vazio?0:1,totalPages:1};
        else if(path.endsWith('/agenda/itens'))dados={items:[{id:31,vendaId:101,bruto:50,taxas:1.5,liquido:48.5},{id:32,vendaId:102,bruto:50,taxas:1.5,liquido:48.5}],page:0,size:200,totalItems:2,totalPages:1};
        if(r.method()==='POST'){await new Promise(r=>setTimeout(r,150));dados=[];}
        if(r.method()==='PUT'){status=op.erroSalvar?409:200;dados=op.erroSalvar?{detail:'Conflito de configuração. Tente novamente.'}:r.postDataJSON();}
        await route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(dados)});
    });
    await page.goto(url+`?tela=${op.tela??'config'}&tema=${op.tema??'light'}`);return {page,chamadas,erros};
}
test('configurações independentes, gravação e teclado não enviam empresaId',async t=>{
    const a=await ambiente(t);await a.page.getByRole('radio',{name:'Controlado',exact:true}).check();await a.page.getByRole('radio',{name:'Total dos meios não dinheiro'}).check();
    await a.page.getByRole('button',{name:'Salvar configurações'}).focus();await a.page.keyboard.press('Enter');await expect(a.page.getByText(/Configurações salvas/)).toBeVisible();
    const p=a.chamadas.find(r=>r.method==='PUT');assert.deepEqual(p.dados,{modo:'CONTROLADO',conferencia:'TOTAL',exigirValoresInformadosNoFechamento:true});assert.deepEqual(a.erros,[]);
});
test('erro de configuração preserva seleção e mostra mensagem',async t=>{
    const a=await ambiente(t,{erroSalvar:true});await a.page.getByRole('radio',{name:'Total dos meios não dinheiro'}).check();await a.page.getByRole('button',{name:'Salvar configurações'}).click();
    await expect(a.page.getByText('Conflito de configuração. Tente novamente.')).toBeVisible();await expect(a.page.getByRole('radio',{name:'Total dos meios não dinheiro'})).toBeChecked();
});
test('operador consulta mas não edita configurações',async t=>{
    const a=await ambiente(t,{perfil:'OPERADOR'});await expect(a.page.getByRole('radio',{name:'Simplificado',exact:true})).toBeDisabled();assert.equal(await a.page.getByRole('button',{name:'Salvar configurações'}).count(),0);
});
test('conferência separa configurações PIX e não inclui dinheiro no total',()=>{
    const c=modulo.conferenciaMeios(resumo,politica,{'c:7':'30','c:8':'10','c:9':'40'},'');assert.equal(c.linhas.length,3);assert.equal(c.esperado,80);assert.equal(c.divergencia,false);assert.equal(c.incompleto,false);
    assert.deepEqual(c.pedido('').meios.map(l=>l.configuracaoId),[7,8,9]);assert.ok(c.pedido('').meios.every(l=>l.formaPagamentoId===null));
});
test('total, divergências e valor opcional não inventam conferência',()=>{
    const p={...politica,conferencia:'TOTAL',exigirValoresInformadosNoFechamento:false};const c=modulo.conferenciaMeios(resumo,p,{},'');assert.equal(c.incompleto,false);assert.equal(c.pedido('').totalInformado,null);
    for(const [valor,dif]of [['80',false],['79',true],['81',true]])assert.equal(modulo.conferenciaMeios(resumo,p,{},valor).divergencia,dif);
    assert.equal(modulo.conferenciaMeios(resumo,p,{},'-1').invalido,true);assert.equal(modulo.conferenciaMeios(resumo,p,{},'1,001').invalido,true);
});
test('agenda não liquida por abrir, informa previsão e envia apenas IDs ao confirmar',async t=>{
    const a=await ambiente(t,{tela:'agenda'});await expect(a.page.getByText('Banco Inter',{exact:true})).toBeVisible();assert.equal(a.chamadas.filter(r=>r.method==='POST').length,0);
    await a.page.getByRole('button',{name:'Confirmar recebimento',exact:true}).click();const dialog=a.page.getByRole('dialog').last();await expect(dialog.getByText(/Valor a creditar/)).toContainText('97,00');
    assert.equal(await dialog.getByRole('link').count(),2);const botao=dialog.getByRole('button',{name:'Confirmar recebimento',exact:true});await botao.focus();await a.page.keyboard.press('Enter');await a.page.keyboard.press('Enter');
    await expect(a.page.getByText(/2 recebíveis liquidados/)).toBeVisible();const posts=a.chamadas.filter(r=>r.method==='POST');assert.equal(posts.length,1);assert.deepEqual(posts[0].dados,{recebivelIds:[31,32]});assert.deepEqual(a.erros,[]);
});
test('cancelar lote por Escape não grava',async t=>{
    const a=await ambiente(t,{tela:'agenda'});await a.page.getByRole('button',{name:'Confirmar recebimento',exact:true}).click();await expect(a.page.getByText('Valor a creditar:',{exact:false})).toBeVisible();
    await a.page.keyboard.press('Escape');assert.equal(await a.page.getByRole('dialog').count(),1);assert.equal(a.chamadas.filter(r=>r.method==='POST').length,0);
});
test('agenda controlada e operador não oferecem liquidação em lote',async t=>{
    for(const op of [{controlado:true},{perfil:'OPERADOR'}]){const a=await ambiente(t,{...op,tela:'agenda'});await expect(a.page.getByText('Banco Inter',{exact:true})).toBeVisible();assert.equal(await a.page.getByRole('button',{name:'Confirmar recebimento',exact:true}).count(),0);}
});
test('agenda vazia apresenta estado de consulta',async t=>{const a=await ambiente(t,{tela:'agenda',vazio:true});await expect(a.page.getByText('Nenhum recebimento pendente')).toBeVisible();});
for(const [nome,viewport,tema] of [['desktop',{width:1440,height:900},'light'],['notebook',{width:1024,height:768},'dark'],['mobile',{width:390,height:844},'auto'],['janela baixa',{width:1280,height:400},'dark']]) {
    test(`configuração e conferência acessíveis em ${nome} (${tema})`,async t=>{
        const a=await ambiente(t,{viewport,tema});await expect(a.page.getByRole('button',{name:'Salvar configurações'})).toBeVisible();
        assert.equal(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await a.page.getByRole('radio',{name:'Simplificado',exact:true}).focus();await a.page.keyboard.press('ArrowDown');
        await expect(a.page.getByRole('radio',{name:'Controlado',exact:true})).toBeChecked();assert.deepEqual(a.erros,[]);
        await a.page.goto(url+`?tela=conferencia&tema=${tema}`);const nubank=a.page.getByRole('textbox',{name:/Valor conferido de PIX Nubank/});await nubank.fill('30');await a.page.keyboard.press('Tab');await a.page.keyboard.press('Shift+Tab');await expect(nubank).toBeFocused();
        assert.equal(await a.page.getByRole('textbox',{name:/Valor conferido de PIX Sicredi/}).count(),1);assert.equal(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        await a.page.screenshot({path:join(tmpdir(),`novexa-politicas-conferencia-${viewport.width}.png`),fullPage:true});
    });
}

for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:1280,height:400}])test(`agenda mantém confirmação acessível em ${viewport.width}x${viewport.height}`,async t=>{
    const a=await ambiente(t,{tela:'agenda',viewport,tema:'dark'});await a.page.getByRole('button',{name:'Confirmar recebimento',exact:true}).click();
    const dialog=a.page.getByRole('dialog').last();const confirmar=dialog.getByRole('button',{name:'Confirmar recebimento',exact:true});await expect(confirmar).toBeEnabled();
    await confirmar.focus();await expect(confirmar).toBeFocused();assert.equal(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await expect(dialog.locator('..')).toHaveCSS('opacity','1');
    await a.page.screenshot({path:join(tmpdir(),`novexa-politicas-agenda-${viewport.width}.png`),fullPage:true});
    await a.page.keyboard.press('Escape');assert.equal(a.chamadas.filter(r=>r.method==='POST').length,0);
});

test('conferência TOTAL mostra diferença sem outro campo de dinheiro',async t=>{
    const a=await ambiente(t,{tela:'conferencia'});await a.page.goto(url+'?tela=conferencia&total');
    await a.page.getByRole('textbox',{name:/Total conferido dos meios não dinheiro/}).fill('79');
    await expect(a.page.getByRole('status')).toContainText('-R$');await expect(a.page.getByRole('status')).toContainText('1,00');
    assert.equal(await a.page.getByRole('textbox').count(),1);assert.equal(a.chamadas.filter(r=>r.method!=='GET').length,0);
});
