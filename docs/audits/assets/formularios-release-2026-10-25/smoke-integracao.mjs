import {chromium,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=process.env.RELEASE15D_ROOT;
const state=JSON.parse(await readFile(root+'/state.json','utf8'));
if(state.database!=='novexa_forms_test'||state.stopped||state.pgport===5432||state.apiport===8080||state.uiport===5173)throw new Error('Somente ambiente descartável 15D em portas próprias.');
const ids=JSON.parse(await readFile(root+'/smoke-ids.json','utf8'));
const base=`http://127.0.0.1:${state.uiport}`,api=`http://127.0.0.1:${state.apiport}`;
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'pt-BR'});
page.setDefaultTimeout(10000);
const failures=[],requests=[],steps=[];
await mkdir(root+'/visual',{recursive:true});
page.on('pageerror',e=>failures.push(e.message));
await page.route('**/*',route=>{
 const u=new URL(route.request().url());
 return ['127.0.0.1','localhost'].includes(u.hostname)||u.protocol==='data:'?route.continue():route.abort('blockedbyclient');
});
page.on('response',async response=>{
 if(response.url().startsWith(api)){
  const rq=response.request();requests.push({method:rq.method(),path:new URL(rq.url()).pathname,status:response.status(),...(!['GET','OPTIONS'].includes(rq.method())&&!rq.url().includes('/auth/')?{body:rq.postDataJSON()}: {})});
 }
});
async function capture(name){await page.screenshot({path:root+'/visual/'+name+'.png',fullPage:true});}
const field=name=>page.getByLabel(name,{exact:true});
try{
 await page.goto(base+'/login');await field('CPF').fill('12345678909');await field('Senha').fill('formTeste123');
 await page.getByRole('button',{name:/Acessar/i}).click();await expect(page).toHaveURL(/dashboard$/);steps.push('login_real');
 const route=process.env.RELEASE15D_ROUTE||'/pdv';
 await page.goto(base+route);await page.waitForTimeout(1800);
 if(route==='/pdv'){
  const opening=page.getByRole('dialog',{name:'Abrir Caixa',exact:true});
  if(await opening.isVisible()){
   await opening.getByRole('button',{name:'Confirmar abertura'}).click();
   await expect(opening).toBeHidden();steps.push('abertura_caixa_zero_ui');
  }
  const login=await (await fetch(api+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cpf:'12345678909',senha:'formTeste123'})})).json();
  const product=await(await fetch(api+'/produtos/'+ids.produto,{headers:{Authorization:'Bearer '+login.token}})).json();
  const search=page.getByRole('combobox',{name:'Buscar produto ou ler código de barras',exact:true});
  await page.keyboard.press('F5');await expect(search).toBeFocused();
  await search.fill(product.codigoInterno);await search.press('Enter');
  await expect(page.getByRole('row').filter({hasText:product.nome})).toBeVisible();
  await page.keyboard.press('F3');
  const quantity=page.getByLabel('Quantidade de '+product.nome,{exact:true});
  await expect(quantity).toBeFocused();await quantity.fill('1,250');await quantity.press('Enter');
  steps.push('pdv_f5_codigo_quantidade_fracionada');
  await page.keyboard.press('F2');await page.waitForTimeout(500);
  await field('Valor de 15D credito (R$)').fill('');
  await field('Valor de 15D dinheiro (R$)').fill('8,00');
  await field('Valor de 15D pix (R$)').fill('5,13');
  await capture('pdv-misto');
  const response=page.waitForResponse(r=>r.url()===api+'/vendas'&&r.request().method()==='POST');
  await page.keyboard.press('F2');const saved=await response;expect(saved.status()).toBe(201);
  const sale=await saved.json();expect(sale.status).toBe('FATURADA');expect(sale.total).toBe(13.13);
  const sent=saved.request().postDataJSON();expect(sent.itens[0].quantidade).toBe(1.25);
  expect(sent.pagamentos.map(p=>p.valor).sort()).toEqual([5.13,8]);
  await writeFile(root+'/pdv-sale.json',JSON.stringify({response:sale,request:sent},null,2));
  steps.push('pdv_pagamento_misto_http_201_faturada');
  await page.goto(base+'/financeiro/caixas');await page.waitForTimeout(1400);
 }
 if(route==='/financeiro/caixas'){
  await page.getByRole('button',{name:'Fechar Caixa',exact:true}).click();
  await page.getByLabel(/Dinheiro físico contado/).fill('8,00');
  await page.getByLabel('Valor mantido para troco (R$)',{exact:true}).fill('8,00');
  await expect(page.getByText('Carregando configuração do fechamento…')).toBeHidden();
  const conference=page.getByLabel('Valor conferido de 15D pix (R$)',{exact:false});
  if(await conference.count())await conference.fill('5,13');
  await capture('fechamento');
  const closing=page.waitForResponse(r=>/\/sessoes\/\d+\/fechar$/.test(r.url())&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Confirmar fechamento',exact:true}).click();
  const closed=await closing;expect(closed.status()).toBe(200);const data=await closed.json();expect(data.status).toBe('FECHADO');
  await writeFile(root+'/caixa-closed.json',JSON.stringify({response:data,request:closed.request().postDataJSON()},null,2));
  steps.push('fechamento_caixa_ui_diferenca_zero');
 }
 if(route==='/financeiro/contas-pagar'){
  await page.getByRole('button',{name:'Nova conta',exact:true}).click();
  await page.getByLabel(/^Descrição/).fill('Conta pagar UI 15D');
  await page.getByLabel(/^Vencimento/).last().fill('2026-10-25');
  const amount=page.getByLabel(/^Valor \(R\$\)/);await amount.fill('1.234,567');await amount.press('Tab');
  await expect(amount).toHaveAttribute('aria-invalid','true');
  expect(requests.filter(r=>r.method==='POST'&&r.path==='/financeiro/contas-pagar')).toHaveLength(0);
  await amount.fill('1.234,56');await amount.press('Tab');
  await capture('conta-pagar');
  const saving=page.waitForResponse(r=>r.url()===api+'/financeiro/contas-pagar'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  const saved=await saving;expect(saved.status()).toBe(201);expect((await saved.json()).valor).toBe(1234.56);
  expect(saved.request().postDataJSON().valor).toBe(1234.56);steps.push('conta_pagar_ui_precisao_e_http_201');
 }
 if(route==='/financeiro/contas-receber'){
  await page.getByRole('button',{name:'Nova conta',exact:true}).click();
  const client=page.getByRole('combobox',{name:/Cliente/});await client.fill('Cliente sintetico');
  await page.getByRole('option').filter({hasText:'Cliente sintetico 15D'}).last().click();
  await page.getByLabel(/^Descrição/).fill('Conta receber UI 15D');
  await page.getByLabel(/^Valor original/).fill('10,50');await page.getByLabel(/^Vencimento/).last().fill('2026-10-25');
  await capture('conta-receber');
  const saving=page.waitForResponse(r=>r.url()===api+'/financeiro/contas-receber'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  const saved=await saving;expect(saved.status()).toBe(201);expect((await saved.json()).valorOriginal).toBe(10.5);
  expect(saved.request().postDataJSON().valorOriginal).toBe(10.5);steps.push('conta_receber_ui_http_201');
 }
 if(route==='/produtos'){
  const row=page.getByRole('row').filter({hasText:'Kit 15D'});await row.getByRole('button',{name:'Editar produto',exact:true}).click();
  await page.getByRole('tab',{name:'Kit/Combo',exact:true}).click();
  const factor=page.getByLabel('Fator para KG',{exact:true});await expect(factor).toHaveValue('0,000002');
  await factor.fill('0,000004');await factor.press('Tab');await capture('kit-fator');
  const saving=page.waitForResponse(r=>r.url()===api+'/produtos/'+ids.kit&&r.request().method()==='PUT');
  await page.getByRole('button',{name:'Salvar alterações',exact:true}).click();
  const saved=await saving;expect(saved.status()).toBe(200);expect(saved.request().postDataJSON().componentes[0].fator).toBe(0.000004);
  steps.push('kit_edicao_fator_seis_casas_http_200');
 }
 if(route==='/estoque'){
  const row=page.getByRole('row').filter({hasText:'Release KG'}).last();
  await row.getByRole('button',{name:'Registrar entrada avulsa',exact:true}).click();
  const qty=page.getByLabel(/^Quantidade/);await qty.fill('0,125');await qty.press('Tab');
  await capture('estoque-entrada');
  const saving=page.waitForResponse(r=>r.url()===api+'/estoque/movimentacoes/entrada'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Confirmar',exact:true}).click();
  const saved=await saving;expect(saved.status()).toBe(201);expect(saved.request().postDataJSON().quantidade).toBe(0.125);
  steps.push('entrada_estoque_ui_tres_casas_http_201');
 }
 if(route==='/financeiro/contas-financeiras'){
  await page.getByRole('row').filter({hasText:'Carteira 15D origem'}).getByRole('button',{name:'Transferir',exact:true}).click();
  await page.getByLabel(/^Conta de destino/).click();
  await page.getByRole('option').filter({hasText:'Carteira 15D destino'}).click();
  await page.getByLabel(/^Valor \(R\$\)/).fill('123,45');await page.getByLabel(/^Data do movimento/).fill('2026-10-25');
  await capture('transferencia');
  const saving=page.waitForResponse(r=>r.url()===api+'/financeiro/transferencias'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Confirmar transferência',exact:true}).click();
  const saved=await saving;expect(saved.status()).toBe(200);expect(saved.request().postDataJSON().valor).toBe(123.45);
  await writeFile(root+'/transferencia-ui.json',JSON.stringify(await saved.json(),null,2));steps.push('transferencia_ui_http_200');
 }
 if(route==='/estoque?aba=entradas'){
  await page.getByRole('button',{name:'Entrada manual',exact:true}).click();
  await page.getByRole('combobox',{name:/Fornecedor/}).fill('Fornecedor sintetico');
  await page.getByRole('option').filter({hasText:'Fornecedor sintetico 15D'}).last().click();
  await page.getByRole('combobox',{name:/Produto/}).fill('Release KG');
  await page.getByRole('option').filter({hasText:'Release KG'}).last().click();
  await page.getByLabel(/^Quantidade/).fill('0,125');await page.getByLabel(/^Custo unitário/).fill('10,50');
  await capture('compra');
  await page.getByRole('button',{name:'Confirmar entrada',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Confirmar entrada?',exact:true});
  const saving=page.waitForResponse(r=>/\/estoque\/entradas\/\d+\/confirmar$/.test(r.url())&&r.request().method()==='POST');
  await dialog.getByRole('button',{name:'Confirmar entrada',exact:true}).click();
  const saved=await saving;expect(saved.status()).toBe(200);expect((await saved.json()).status).toBe('CONFIRMADA');
  steps.push('compra_ui_rascunho_confirmacao_pg');
 }
 if(route==='/financeiro/formas-pagamento'){
  await page.getByRole('row').filter({hasText:'15D credito'}).getByRole('button',{name:'Editar configuração de pagamento',exact:true}).click();
  const rate=page.getByLabel('Taxa percentual (%)',{exact:true});await expect(rate).toHaveValue('3,1234');
  await rate.fill('0,0002');await rate.press('Tab');await capture('taxa-quatro-casas');
  const saving=page.waitForResponse(r=>r.url()===api+'/financeiro/configuracoes-formas-pagamento/'+ids.credito&&r.request().method()==='PUT');
  await page.getByRole('button',{name:'Atualizar',exact:true}).click();
  const saved=await saving;expect(saved.status()).toBe(200);expect(saved.request().postDataJSON().taxaPercentual).toBe(0.0002);
  expect((await saved.json()).taxaPercentual).toBe(0.0002);steps.push('taxa_ui_quatro_casas_http_200');
 }
 await writeFile(root+'/ui-dom.txt',await page.locator('body').innerText());
 await capture('initial');
}finally{
 await writeFile(root+'/browser-smoke.json',JSON.stringify({steps,failures,requests},null,2));
 await writeFile(root+'/browser-'+(process.env.RELEASE15D_ROUTE||'pdv').replace(/[^a-z0-9-]/gi,'-')+'.json',JSON.stringify({steps,failures,requests},null,2));
 await browser.close();
}
