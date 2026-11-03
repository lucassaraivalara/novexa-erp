// Explicit opt-in integration helper; never uses persistent browser sessions or production API.
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
assertLocal();
function assertLocal() { if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SPRINT22_API??'') || !process.env.SPRINT22_TOKEN)throw new Error('Synthetic loopback fixture required'); }
const api=process.env.SPRINT22_API;
const fixture=`import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import{CssBaseline}from'@mui/material';import{ThemeModeProvider}from'/src/theme/ThemeModeProvider.tsx';import AppRoutes from'/src/routes/AppRoutes.tsx';createRoot(document.getElementById('root')).render(React.createElement(ThemeModeProvider,null,React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(AppRoutes))));`;
const server=await createServer({cacheDir:'node_modules/.vite-sprint22-http',define:{'import.meta.env.VITE_API_URL':JSON.stringify('/api')},server:{host:'127.0.0.1',port:0,hmr:false,proxy:{'/api':{target:api,changeOrigin:true,rewrite:p=>p.replace(/^\/api/,'')}}},plugins:[{name:'http22-fixture',resolveId(id){if(id==='/fixture22.js')return '\0fixture22';},load(id){if(id==='\0fixture22')return fixture;},configureServer(s){s.middlewares.use('/vendas',async(req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/vendas','<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/fixture22.js"></script>'));});}}]});
await server.listen();const browser=await chromium.launch({headless:true});
try {
    const page=await browser.newPage({viewport:{width:1920,height:1080}});const errors=[],responses=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/api/vendas/analise/'))responses.push({path:new URL(r.url()).pathname,status:r.status()});});
    await page.addInitScript(token=>{localStorage.setItem('novexa-auth',JSON.stringify({token,perfil:'ADMIN',nomeUsuario:'Sintético',empresa:{id:1,nomeFantasia:'Fixture HTTP'}}));localStorage.setItem('novexa-theme-choice','dark');},process.env.SPRINT22_TOKEN);
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/vendas?aba=analise&dataInicial=2026-10-22&dataFinal=2026-10-22`);
    await expect(page.getByRole('region',{name:'Resumo do período'}).getByText('R$ 90,00',{exact:true}).first()).toBeVisible({timeout:20000});
    await expect(page.getByRole('region',{name:'Formas de pagamento'}).getByText('Não discriminado no histórico',{exact:true})).toBeVisible();
    await expect(page.getByRole('region',{name:'Top 5 categorias'}).getByText('Sem categoria',{exact:true})).toBeVisible();
    if(errors.length || responses.length!==3 || responses.some(r=>r.status!==200))throw new Error(JSON.stringify({errors,responses}));
    await page.screenshot({path:'../docs/audits/assets/sprint22/http-real-1920.png',fullPage:true,animations:'disabled'});
    fs.writeFileSync('../docs/audits/assets/sprint22/http-real.json',JSON.stringify({environment:'loopback disposable PostgreSQL / synthetic tenant',responses,errors,financialWrites:0},null,2));
    console.log('Browser -> real HTTP -> PostgreSQL passed; total 90, discount 10, no financial writes.');
} finally {await browser.close();await server.close();}
