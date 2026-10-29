import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';

let vite, browser, base;
const beforeView = process.env.NOVEXA_G1_BEFORE === '1';
const beforeG4 = process.env.NOVEXA_G4_BEFORE === '1';
const sampleG4 = process.env.NOVEXA_G4_SAMPLE === '1';
const output = '../docs/audits/assets/sprint20g4';
before(async () => {
    fs.mkdirSync(output, { recursive: true });
    const component = beforeView ? 'AjusteEstoqueMassa20g1Before' : 'AjusteEstoqueMassa';
    const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';import {CssBaseline} from '@mui/material';import {ThemeModeProvider} from '/src/theme/ThemeModeProvider.tsx';import Ajuste from '/src/pages/Estoque/${component}.tsx';createRoot(document.getElementById('root')).render(React.createElement(ThemeModeProvider,null,React.createElement(CssBaseline),React.createElement('div',{style:{padding:16}},React.createElement(Ajuste,{onConcluido:()=>{}}))));`;
    vite = await createServer({ optimizeDeps: { entries: ["src/pages/Estoque/AjusteEstoqueMassa.tsx"], include: ["react", "react-dom/client"] }, cacheDir: 'node_modules/.vite-compact-test', server: { host: '127.0.0.1', port: 0, hmr: false }, plugins: [{
        name: 'compact-fixture', resolveId(id) { if (id === '/compact.tsx') return '\0compact.tsx'; },
        load(id) { if (id === '\0compact.tsx') return fixture; },
        configureServer(server) { server.middlewares.use('/__compact', async (_, res) => { res.setHeader('Content-Type', 'text/html'); res.end(await server.transformIndexHtml('/__compact', '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/compact.tsx"></script>')); }); },
    }] });
    await vite.listen(); base = `http://127.0.0.1:${vite.httpServer.address().port}/__compact`;
    browser = await chromium.launch();
});
after(async () => { await browser?.close(); await vite?.close(); });

for (const [width, height] of [[1366, 768], [1920, 1080], [390, 844]]) for (const theme of ['light', 'dark']) {
    test(`densidade ${width} ${theme}: 0, 3, 20 e 200 selecionados`, async () => {
        const page = await browser.newPage({ viewport: { width, height } });
        page.setDefaultTimeout(5000);
        const errors = [], writes = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(theme => { localStorage.setItem('novexa-theme-choice', theme); localStorage.setItem('novexa-auth', JSON.stringify({ token: 'fixture', perfil: 'ADMIN', empresa: { id: 1 } })); }, theme);
        const products = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, nome: `Produto ${String(i + 1).padStart(3, '0')}${i === 2 ? ' com descrição longa para conferir quebra de texto sem esconder informações' : ''}`, codigoInterno: String(i + 1).padStart(4, '0'), estoqueAtual: i === 0 ? -2.125 : 10.5, ativo: true, controlaEstoque: true, composto: false }));
        await page.route('http://localhost:8080/**', async route => {
            const url = new URL(route.request().url()), index = Number(url.searchParams.get('page') ?? 0);
            assert.equal(route.request().method(), 'GET', 'matriz visual não confirma movimentos');
            writes.push(route.request().method());
            await route.fulfill({ json: { items: products.slice(index * 10, index * 10 + 10), totalItems: 200, page: index, size: 10, totalPages: 20 } });
        });
        try {
            await page.goto(base);
            await page.getByRole('button', { name: 'Ajuste em massa', exact: true }).click();
            const counts = beforeView || beforeG4 || sampleG4 ? [0, 3] : [0, 3, 20, 200];
            let selected = 0;
            for (const count of counts) {
                if (count > selected) {
                    const search = page.getByRole('textbox', { name: 'Pesquisar produtos', exact: true });
                    await search.click(); await search.fill('Produto');
                    for (let i = selected; i < count; i++) {
                        if (i && i % 10 === 0) {
                            const region = beforeView ? page.locator('body') : page.getByRole('region', { name: 'Resultados da pesquisa' });
                            await region.locator('.MuiTablePagination-actions button').last().click();
                        }
                        const add = page.getByRole('button', { name: `Adicionar ${products[i].nome}`, exact: true });
                        await expect(add).toBeEnabled();
                        // Preparação volumosa por eventos DOM; interação real/teclado coberta pela regressão do ajuste.
                        await add.evaluate(button => button.click());
                    }
                    selected = count;
                    if (!beforeView) { await search.press('Escape'); await expect(page.getByRole('region', { name: 'Resultados da pesquisa' })).toHaveCount(0); }
                }
                await expect(page.getByText(`${count}/200`, { exact: true })).toBeVisible();
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                await expect(page.getByRole('textbox', { name: 'Motivo do ajuste em massa' })).toBeVisible();
                await page.screenshot({ path: `${output}/${beforeView || beforeG4 ? 'antes' : 'depois'}-${width}-${theme}-${count}.png`, fullPage: true, animations: 'disabled' });
            }
            if (!beforeView && !beforeG4 && !sampleG4) {
                assert.equal(await page.getByRole('textbox', { name: /^Saldo físico Produto/ }).count(), 25, 'renderização limitada à página');
                await page.getByRole('textbox', { name: 'Motivo do ajuste em massa' }).scrollIntoViewIfNeeded();
                await expect(page.getByRole('textbox', { name: 'Motivo do ajuste em massa' })).toBeInViewport();
                await page.getByRole('textbox', { name: 'Motivo do ajuste em massa' }).fill('Contagem sintética');
                await page.getByRole('button', { name: 'Remover Produto 001', exact: true }).click();
                await expect(page.getByText('199/200', { exact: true })).toBeVisible();
            }
            assert.deepEqual(errors, []); assert(writes.every(method => method === 'GET'));
        } finally { await page.close(); }
    });
}

test('proporções seguem a área disponível e motivo permanece fora da rolagem dos produtos', async () => {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const products = Array.from({ length: 3 }, (_, i) => ({ id: i + 1, nome: `Produto ${i + 1} com descrição longa para conferir o painel estreito`, codigoInterno: `P00${i + 1}`, estoqueAtual: 0, ativo: true, controlaEstoque: true, composto: false }));
    await page.addInitScript(() => localStorage.setItem('novexa-auth', JSON.stringify({ token: 'fixture', perfil: 'ADMIN', empresa: { id: 1 } })));
    await page.route('http://localhost:8080/**', route => {
        assert.equal(route.request().method(), 'GET');
        return route.fulfill({ json: { items: products, totalItems: 3, page: 0, size: 10, totalPages: 1 } });
    });
    try {
        await page.goto(base);
        await page.getByRole('button', { name: 'Ajuste em massa', exact: true }).click();
        await page.getByRole('textbox', { name: 'Pesquisar produtos', exact: true }).fill('Produto');
        for (const p of products) await page.getByRole('button', { name: `Adicionar ${p.nome}`, exact: true }).click();
        await page.getByRole('textbox', { name: 'Pesquisar produtos', exact: true }).press('Escape');
        for (const [width, contentWidth] of [[1920, 1888], [1366, 1334], [1366, 1080], [390, 358]]) {
            await page.setViewportSize({ width, height: 844 });
            await page.locator('#root > div').evaluate((element, max) => { element.style.maxWidth = `${max + 32}px`; }, contentWidth);
            const left = await page.getByRole('region', { name: 'Produtos do ajuste', exact: true }).boundingBox();
            const right = await page.getByRole('region', { name: 'Conferência do ajuste', exact: true }).boundingBox();
            if (width >= 1000) {
                assert(left.width / (left.width + right.width) >= .35 && left.width / (left.width + right.width) <= .405);
                assert(Math.abs(left.y - right.y) < 1);
            } else assert(right.y >= left.y + left.height);
            const list = page.getByRole('region', { name: 'Produtos selecionados para ajuste' });
            assert(await list.evaluate(element => element.scrollWidth <= element.clientWidth));
            assert.equal(await list.getByRole('textbox', { name: 'Motivo do ajuste em massa' }).count(), 0);
            await expect(page.getByRole('textbox', { name: 'Motivo do ajuste em massa' })).toBeEnabled();
            assert.equal(await page.getByRole('button', { name: 'Gerar prévia', exact: true }).locator('svg').count(), 1);
            await page.screenshot({ path: `${output}/depois-area-${width}-${contentWidth}.png`, fullPage: true, animations: 'disabled' });
        }
    } finally { await page.close(); }
});
