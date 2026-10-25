import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,posix} from 'node:path';
import ts from 'typescript';
import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';

// Componentes reais, HTTP interceptado integralmente: nenhum teste alcança dados locais/produção.
const forms={
 cliente:['pages/Clientes/ClienteForm.tsx',`{cliente:edit?{id:42,nome:'Cliente existente',cpfCnpj:'',limiteCredito:1234.56}:null,onFechar:noop,onSalvo:save}`],
 fornecedor:['components/fornecedores/FornecedorForm.tsx',`{modo:'completo',onFechar:noop,onSalvo:save}`],
 kit:['pages/Produtos/ComposicaoProdutoCampos.tsx',`{valor:linhas,onChange:setLinhas,disabled:false}`],
 entrada:['pages/Estoque/EntradaMercadoriaItens.tsx',`{itens,onChange:setItens}`],
 pagar:['pages/Financeiro/ContaPagarDrawer.tsx',`{conta:edit?{id:42,descricao:'Aluguel',valor:1234.56,dataVencimento:'2026-11-10'}:null,onFechar:noop,onSalvo:save}`],
 receber:['pages/Financeiro/ContaReceberForm.tsx',`{conta:null,clienteInicial:{id:42,nome:'Cliente teste',ativo:true},onFechar:noop,onSalvo:save}`],
 movimento:['pages/Financeiro/MovimentacaoFinanceiraDrawer.tsx',`{conta:{id:5,nome:'Conta teste',saldoAtual:5000},onFechar:noop,onSalvo:save}`],
 conta:['pages/Financeiro/ContaFinanceiraDrawer.tsx',`{conta:edit?{id:42,nome:'Cofre teste',tipo:'COFRE',saldoInicial:5000,saldoAtual:4500}:null,onFechar:noop,onSalvo:save}`],
 transferencia:['pages/Financeiro/TransferenciaFinanceiraDrawer.tsx',`{contas:[{id:5,nome:'Origem',saldoAtual:5000,tipo:'BANCO',ativo:true},{id:6,nome:'Destino',tipo:'BANCO',ativo:true}],origemId:5,onFechar:noop,onSalvo:save}`],
 extrato:['pages/Financeiro/ExtratoFinanceiroDrawer.tsx',`{conta:{id:5,nome:'Conta teste',tipo:'BANCO',saldoAtual:5000},onFechar:noop,onSaldoAlterado:noop}`],
 configuracao:['pages/Financeiro/ConfiguracaoFormaPagamentoForm.tsx',`{config:{id:42,nomeExibicao:'Crédito teste',formaPagamentoId:4,tipo:'CREDITO',ativo:true,maximoParcelasConsumidor:3,taxaPercentual:0.0002,taxaFixa:1.25,prazoRecebimentoDias:1,contaFinanceiraDestino:{id:5,nome:'Banco teste',tipo:'BANCO',ativo:true}},onFechar:noop,onSalvo:save}`],
 usuario:['pages/Usuarios/UsuarioDrawer.tsx',`{usuario:edit?{id:42,nomeUsuario:'Pessoa teste',cpf:'12345678909',login:'teste',email:'teste@example.test',perfil:'OPERADOR',ativo:true}:null,onFechar:noop,onSalvo:save}`],
 empresa:['pages/Empresa/EmpresaForm.tsx',`{empresa:null,onFechar:noop,onSalvo:save}`],
 pdv:['pages/Vendas/ValorMonetarioPDV.tsx',`{label:'Valor recebido',value:valor,onChange:setValor,fullWidth:true,slotProps:{htmlInput:{inputMode:'decimal'}}}`],
};
let server,browser,url;
function fixture(key,antes){const [file,props]=forms[key];return `
import React,{useState} from 'react';import {createRoot}from'react-dom/client';
import {ThemeProvider,CssBaseline,Box}from'@mui/material';import{BrowserRouter}from'react-router-dom';
import{createNovexaTheme}from'/src/theme/theme.ts';import Form from '${antes?'/before':'/src'}/${file}';
const q=new URLSearchParams(location.search),edit=q.has('edit'),noop=()=>{},save=v=>window.__salvo=v;
function App(){const[valor,setValor]=useState('10.50'),[linhas,setLinhas]=useState([{produtoId:1,nome:'Componente teste',unidadeEstoque:'UN',unidade:'CX',quantidade:'1.25',fator:'0.000002'}]),[itens,setItens]=useState([{chave:'1',produto:{id:1,nome:'Produto teste',precoCusto:10.5},quantidade:'1.25',custo:'10.50'}]);
window.__estado={linhas,itens,valor};return <ThemeProvider theme={createNovexaTheme(q.has('dark')?'dark':'light')}><CssBaseline/><BrowserRouter><Box sx={{p:3,maxWidth:'100vw'}}><Form {...${props}}/></Box></BrowserRouter></ThemeProvider>}
createRoot(document.getElementById('root')).render(<App/>);`;}
before(async()=>{
 server=await createServer({cacheDir:'node_modules/.vite-formularios-completos-tests',server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{
 name:'formularios-completos-fixture',resolveId(id){if(id.startsWith('/form-')||id.startsWith('/before/'))return '\0'+id;},
 async load(id){if(id.startsWith('\0/form-')){const [key,before]=id.slice(7).split('.');return ts.transpileModule(fixture(key,before==='before'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext}}).outputText;}
 if(id.startsWith('\0/before/')){let file=id.slice(9);if(!/\.(tsx?|css)$/.test(file)){try{await readFile(resolve(process.env.FORM_15B_BASELINE,'src',file+'.tsx'));file+='.tsx';}catch{file+='.ts';}}
 const source=await readFile(resolve(process.env.FORM_15B_BASELINE,'src',file),'utf8');const imports=source.replace(/from ["'](\.\.?\/[^"'\n]+)["']/g,(_,p)=>`from "${posix.resolve('/before',posix.dirname(file),p)}"`);return ts.transpileModule(imports,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext}}).outputText;}},
 configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(!req.url.startsWith('/forms/'))return next();const key=req.url.split('/')[2].split('?')[0];if(!forms[key])return next();res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml(req.url,`<div id="root"></div><script type="module" src="/form-${key}${req.url.includes('before')?'.before':''}.js"></script>`));});}
 }]});await server.listen();url=`http://127.0.0.1:${server.httpServer.address().port}`;browser=await chromium.launch({headless:true});
});
after(async()=>{await browser?.close();await server?.close();});
async function withForm(key,run,{query='',viewport={width:1440,height:960}}={}){
 const page=await browser.newPage({viewport});page.setDefaultTimeout(7000);const writes=[],errors=[];
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('novexa-auth',JSON.stringify({token:'test-only',perfil:'ADMIN',id:1,empresa:{id:7}})));
 await page.route('**/*',async route=>{const r=route.request();if(!['fetch','xhr'].includes(r.resourceType()))return route.continue();const p=new URL(r.url()).pathname;
 if(['POST','PUT','PATCH'].includes(r.method())){const payload=r.postDataJSON();writes.push({path:p,payload});return route.fulfill({json:{...payload,id:42}});}
 if(p.includes('movimentacoes-financeiras'))return route.fulfill({json:{items:[{id:9,contaFinanceiraId:5,dataMovimento:'2026-10-24',descricao:'Movimento teste',tipo:'SAIDA',origem:query.includes('transferencia')?'TRANSFERENCIA':'MANUAL',transferenciaId:query.includes('transferencia')?42:null,contaContraparteNome:'Destino teste',valor:10.5,estornada:false,usuarioNome:'Pessoa teste'}],totalItems:1,totalPages:1}});
 if(p.includes('contas-financeiras'))return route.fulfill({json:[{id:5,nome:'Banco teste',tipo:'BANCO',ativo:true,saldoAtual:5000}]});
 if(p.includes('contas-bancarias'))return route.fulfill({json:[]});
 if(p.includes('clientes/42'))return route.fulfill({json:{id:42,nome:'Cliente teste',ativo:true}});
 if(p.includes('produtos'))return route.fulfill({json:{items:[],totalItems:0,totalPages:0}});
 if(/fornecedores|categorias|marcas|subcategorias/.test(p))return route.fulfill({json:{items:[],totalItems:0,totalPages:0}});
 return route.abort('blockedbyclient');});
 try{await page.goto(`${url}/forms/${key}${query}`);await page.locator('input').first().waitFor();await run(page,writes);assert.deepEqual(errors,[]);}finally{await page.close();}
}
const field=(p,name)=>p.getByLabel(new RegExp('^'+name+'\\s*\\*?$'));
test('cliente: limite brasileiro, vazio opcional, edição e payload numérico',async()=>{
 await withForm('cliente',async(p,w)=>{await field(p,'Nome / Razão social').fill('Cliente teste');await p.getByRole('tab',{name:'Comercial e Financeiro'}).click();await field(p,'Limite de crédito').fill('1.234,56');await p.getByRole('button',{name:'Salvar cliente',exact:true}).click();await expect.poll(()=>w.length).toBe(1);assert.equal(w[0].payload.limiteCredito,1234.56);});
 await withForm('cliente',async(p)=>{await p.getByRole('tab',{name:'Comercial e Financeiro'}).click();await expect(field(p,'Limite de crédito')).toHaveValue('1.234,56');},{query:'?edit'});
});
test('kit: quantidade 3 e fator 6 casas permanecem exatos após colagem e blur',async()=>withForm('kit',async p=>{
 await p.evaluate(()=>navigator.clipboard.writeText('1.250,125'));await field(p,'Quantidade').focus();await field(p,'Quantidade').press('Control+A');await field(p,'Quantidade').press('Control+V');await field(p,'Fator para UN').fill('0,000002');await p.locator('h3').click();const v=await p.evaluate(()=>window.__estado.linhas[0]);assert.equal(v.quantidade,'1250.125');assert.equal(v.fator,'0.000002');await expect(field(p,'Fator para UN')).toHaveValue('0,000002');
}));
test('entrada: preserva custo 2 e quantidade 3, sem arredondar entradas inválidas',async()=>withForm('entrada',async p=>{
 await field(p,'Quantidade').fill('0,125');await field(p,'Custo unitário').fill('1.234,56');await p.locator('body').click({position:{x:1,y:1}});const v=await p.evaluate(()=>window.__estado.itens[0]);assert.equal(v.quantidade,'0.125');assert.equal(v.custo,'1234.56');await field(p,'Custo unitário').fill('0,0002');await expect(field(p,'Custo unitário')).toHaveAttribute('aria-invalid','true');
}));
for(const key of ['pagar','movimento'])test(`${key}: moeda brasileira envia 1234.56; edição mantém duas casas`,async()=>withForm(key,async(p,w)=>{
 await field(p,'Descrição').fill('Operação teste');await field(p,'Valor \\(R\\$\\)').fill('1.234,56');if(key==='pagar')await field(p,'Vencimento').fill('2026-11-10');await p.getByRole('button',{name:key==='pagar'?'Salvar':'Registrar',exact:true}).click();await expect.poll(()=>w.length).toBe(1);assert.equal(w[0].payload.valor,1234.56);
}));
test('configuração: taxa de quatro casas e taxa fixa brasileira mantêm o contrato',async()=>withForm('configuracao',async(p,w)=>{
 await expect(field(p,'Taxa percentual \\(%\\)')).toHaveValue('0,0002');await field(p,'Taxa percentual \\(%\\)').fill('10,5000');await field(p,'Taxa fixa \\(R\\$\\)').fill('1.234,56');await p.getByRole('button',{name:/Atualizar/}).click();await expect.poll(()=>w.length).toBe(1);assert.equal(w[0].payload.taxaPercentual,10.5);assert.equal(w[0].payload.taxaFixa,1234.56);
}));
test('usuário: erros preservados, CPF e senha com navegação por teclado',async()=>withForm('usuario',async p=>{
 await field(p,'Nome').fill('Pessoa teste');await field(p,'Nome').press('Tab');await expect(field(p,'CPF')).toBeFocused();await expect(field(p,'Senha')).toHaveAttribute('autocomplete','new-password');await field(p,'Login').fill('teste');await field(p,'E-mail').fill('teste@example.test');await field(p,'Senha').fill('somente-teste');await field(p,'CPF').fill('123');await p.getByRole('button',{name:/Salvar/}).click();await expect(field(p,'CPF')).toHaveAttribute('aria-invalid','true');
}));
test('PDV: preserva parser, foco, precisão e formatação com agrupamento brasileiro',async()=>withForm('pdv',async p=>{
 await field(p,'Valor recebido').fill('1.234,56');await field(p,'Valor recebido').press('Tab');await expect(field(p,'Valor recebido')).toHaveValue('1.234,56');assert.equal(await p.evaluate(()=>window.__estado.valor),'1234.56');
}));
test('cliente: endereço e contato mantêm campos textuais e persistem no mesmo payload',async()=>withForm('cliente',async(p,w)=>{
 await field(p,'Nome / Razão social').fill('Cliente com endereço');await p.getByRole('tab',{name:'Endereços',exact:true}).click();await p.getByRole('button',{name:'Adicionar endereço'}).click();await field(p,'Logradouro').fill('Rua teste');await field(p,'Número').fill('003');await field(p,'UF').fill('sp');await field(p,'CEP').fill('01001-000');await p.getByRole('button',{name:'Usar endereço'}).click();await p.getByRole('tab',{name:'Contatos',exact:true}).click();await p.getByRole('button',{name:'Adicionar contato'}).click();await field(p,'Nome').fill('Compras');await field(p,'E-mail').fill('compras@example.test');await p.getByRole('button',{name:'Usar contato'}).click();await p.getByRole('button',{name:'Salvar cliente',exact:true}).click();await expect.poll(()=>w.length).toBe(1);assert.equal(w[0].payload.enderecos[0].numero,'003');assert.equal(w[0].payload.enderecos[0].uf,'SP');assert.equal(w[0].payload.contatos[0].email,'compras@example.test');assert.equal(w[0].payload.limiteCredito,null);
}));
test('conta financeira: criação recebe saldo brasileiro; edição não regrava saldos',async()=>{
 await withForm('conta',async(p,w)=>{await field(p,'Nome').fill('Cofre novo');await p.getByRole('combobox',{name:'Tipo',exact:true}).click();await p.getByRole('option',{name:'Cofre',exact:true}).click();await field(p,'Saldo inicial \\(R\\$\\)').fill('1.234,56');await p.getByRole('button',{name:'Salvar',exact:true}).click();await expect.poll(()=>w.length).toBe(1);assert.equal(w[0].payload.saldoInicial,1234.56);assert.equal(w[0].payload.tipo,'COFRE');});
 await withForm('conta',async(p,w)=>{await expect(field(p,'Saldo inicial')).toBeDisabled();await field(p,'Nome').fill('Cofre editado');await p.getByRole('button',{name:'Salvar',exact:true}).click();await expect.poll(()=>w.length).toBe(1);assert.ok(!('saldoInicial'in w[0].payload));assert.ok(!('saldoAtual'in w[0].payload));},{query:'?edit'});
});
test('transferência: entrada brasileira preserva contas, valor e chave; não há spinbox monetário',async()=>withForm('transferencia',async(p,w)=>{
 await p.getByRole('combobox',{name:'Conta de destino',exact:true}).click();await p.getByRole('option',{name:'Destino',exact:true}).click();await field(p,'Valor \\(R\\$\\)').fill('1.234,56');assert.equal(await p.getByRole('spinbutton').count(),0);await p.getByRole('button',{name:'Confirmar transferência'}).click();await expect.poll(()=>w.length).toBe(1);assert.equal(w[0].payload.valor,1234.56);assert.equal(w[0].payload.contaOrigemId,5);assert.equal(w[0].payload.contaDestinoId,6);assert.ok(w[0].payload.chaveRequisicao);
}));
test('conta a receber: parcelas usam teclado e incremento sem modificar o valor monetário',async()=>withForm('receber',async(p,w)=>{
 await field(p,'Descrição').fill('Título teste');await field(p,'Valor original \\(R\\$\\)').fill('1.234,56');await field(p,'Vencimento').fill('2026-11-10');await p.getByRole('button',{name:'Aumentar total de parcelas',exact:true}).click();await p.getByRole('button',{name:'Aumentar total de parcelas',exact:true}).click();await field(p,'Parcela').press('ArrowUp');await p.getByRole('button',{name:'Salvar',exact:true}).click();await expect.poll(()=>w.length).toBe(1);assert.equal(w[0].payload.numeroParcela,2);assert.equal(w[0].payload.totalParcelas,3);assert.equal(w[0].payload.valorOriginal,1234.56);
}));
test('valor sem representação segura no contrato number não pode ser enviado apesar de positivo',async()=>withForm('pagar',async(p,w)=>{
 await field(p,'Descrição').fill('Teste de precisão');await field(p,'Vencimento').fill('2026-11-10');await field(p,'Valor \\(R\\$\\)').fill('90071992547409,91');await expect(field(p,'Valor \\(R\\$\\)')).toHaveAttribute('aria-invalid','true');await p.getByRole('button',{name:'Salvar',exact:true}).click();await expect.poll(async()=>w.length+await p.getByRole('alert').count()).toBeGreaterThan(0);assert.equal(w.length,0,'Não enviar valor que perderia centavos na conversão para number');
}));
test('evidência visual: formulários reais antes/depois em desktop/mobile e claro/escuro',{skip:!process.env.FORM_15B_EVIDENCE},async()=>{
 const results=[];await mkdir(process.env.FORM_15B_EVIDENCE,{recursive:true});
 for(const key of ['cliente','entrada','configuracao','usuario','pdv'])for(const mobile of [false,true])for(const dark of [false,true])for(const before of [true,false]){
 const name=`${key}-${before?'antes':'depois'}-${mobile?'mobile':'desktop'}-${dark?'escuro':'claro'}`;
 await withForm(key,async p=>{await p.locator('input').first().focus();await p.locator('input').first().press('Tab');await p.screenshot({path:resolve(process.env.FORM_15B_EVIDENCE,name+'.png'),fullPage:true,animations:'disabled'});const sizes=await p.evaluate(()=>({width:innerWidth,doc:document.documentElement.scrollWidth}));assert.ok(sizes.doc<=sizes.width,`${name}: overflow`);results.push({name,...sizes});},{query:`?${before?'before&':''}${dark?'dark':''}`,viewport:mobile?{width:390,height:844}:{width:1440,height:960}});
 }await writeFile(resolve(process.env.FORM_15B_EVIDENCE,'medidas.json'),JSON.stringify(results,null,2));
});

for(const transferencia of [false,true])test(`extrato: motivo acessível preserva estorno de ${transferencia?'transferência':'movimentação'} pelo teclado`,async()=>withForm('extrato',async(p,w)=>{
 await p.getByRole('button',{name:'Estornar movimentação',exact:true}).click();
 const motivo=field(p,'Motivo do estorno');await expect(motivo).toBeFocused();await expect(motivo).toHaveAttribute('placeholder','Justifique o estorno…');await expect(motivo).toHaveAttribute('maxlength','500');
 assert.ok(await motivo.evaluate(e=>(e.getAttribute('aria-describedby')||'').split(' ').some(id=>document.getElementById(id)?.textContent==='Motivo registrado no histórico da movimentação.')));
 await p.getByRole('button',{name:'Confirmar estorno',exact:true}).click();assert.equal(w.length,0);
 await motivo.fill('  Correção de lançamento  ');await motivo.press('Tab');await expect(p.getByRole('button',{name:'Voltar',exact:true})).toBeFocused();await p.keyboard.press('Tab');await expect(p.getByRole('button',{name:'Confirmar estorno',exact:true})).toBeFocused();await p.keyboard.press('Enter');
 await expect.poll(()=>w.length).toBe(1);assert.deepEqual(w[0].payload,{motivoEstorno:'Correção de lançamento'});
 assert.equal(w[0].path,transferencia?'/financeiro/transferencias/42/estornar':'/financeiro/movimentacoes-financeiras/9/estorno');
},{query:transferencia?'?transferencia':''}));
