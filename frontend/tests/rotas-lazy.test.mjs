import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import zlib from 'node:zlib';

let server, browser, base;
const evidence = '../docs/audits/assets/sprint20h';
before(async () => {
    server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
    base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch();
});
after(async () => { await browser?.close(); await new Promise(r => server.httpServer.close(r)); });
async function pageFor(t, authenticated = true) {
    const page = await browser.newPage();
    t.after(() => page.close());
    if (authenticated) await page.addInitScript(() => { if (sessionStorage.getItem('fixture-seeded')) return; sessionStorage.setItem('fixture-seeded', '1'); localStorage.setItem('novexa-auth', JSON.stringify({
        token: 'fixture', perfil: 'ADMIN', nome: 'Teste', empresa: { id: 1, nome: 'Empresa sintética' },
    })); });
    await page.route('http://localhost:8080/**', route => route.fulfill({ json: { items: [], content: [], totalItems: 0, totalPages: 0, page: 0, size: 20 } }));
    return page;
}

test('build carrega apenas a rota pedida e mantém cache ao voltar', async t => {
    const page = await pageFor(t);
    const requests = [];
    page.on('request', r => { if (r.url().endsWith('.js')) requests.push(r.url().split('/').pop()); });
    const start = performance.now();
    await page.goto(base + '/estoque');
    await expect(page.getByRole('button', { name: 'Ajuste em massa', exact: true })).toBeVisible();
    const elapsed = performance.now() - start;
    assert(requests.some(x => x.startsWith('Estoque-')));
    assert(!requests.some(x => /^(Vendas|ContasPagar|Dashboard|ProdutosArea)-/.test(x)));
    const initial = [...new Set(requests)];
    const assets = fs.readdirSync('dist/assets').filter(x => x.endsWith('.js')).map(name => {
        const bytes = fs.readFileSync('dist/assets/' + name);
        return { name, raw: bytes.length, gzip: zlib.gzipSync(bytes).length, brotli: zlib.brotliCompressSync(bytes).length };
    });
    fs.writeFileSync(evidence + '/after.json', JSON.stringify({ assets, estoqueInitial: initial, estoqueReadyMs: elapsed }, null, 2));
    // Navegação SPA pelo link existente, preservando o shell.
    await page.getByRole('link', { name: 'Vender', exact: true }).first().click();
    await page.waitForURL('**/pdv');
    await expect(page.locator('body')).toContainText('Venda');
    const count = requests.filter(x => x.startsWith('Estoque-')).length;
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Ajuste em massa', exact: true })).toBeVisible();
    assert.equal(requests.filter(x => x.startsWith('Estoque-')).length, count);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Ajuste em massa', exact: true })).toBeVisible();
});

test('sem sessão redireciona sem baixar Estoque e login continua público', async t => {
    const page = await pageFor(t, false), requests = [];
    page.on('request', r => requests.push(r.url()));
    await page.goto(base + '/estoque');
    await expect(page.getByRole('heading', { name: 'Acesso ao sistema' })).toBeVisible();
    assert(!requests.some(x => /\/Estoque-[^/]+\.js/.test(x)));
    assert(page.url().endsWith('/login'));
});

test('chunk lento exibe fallback e falha oferece recuperação sem loop', async t => {
    const page = await pageFor(t);
    let release;
    const gate = new Promise(r => { release = r; });
    await page.route('**/assets/Estoque-*.js', async route => { await gate; await route.abort(); });
    const navigation = page.goto(base + '/estoque', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('status')).toContainText('Carregando tela');
    release();
    await navigation;
    await expect(page.getByRole('button', { name: 'Recarregar página' })).toBeVisible();
    assert(page.url().endsWith('/estoque'));
});

test('logout limpa sessão e acesso direto continua protegido', async t => {
    const page = await pageFor(t);
    await page.goto(base + '/estoque');
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Acesso ao sistema' })).toBeVisible();
    assert.equal(await page.evaluate(() => localStorage.getItem('novexa-auth')), null);
    await page.goto(base + '/produtos');
    await expect(page.getByRole('heading', { name: 'Acesso ao sistema' })).toBeVisible();
});

test('rotas principais e sessão expirada preservam proteção com APIs indisponíveis', async t => {
    const timings = [];
    for (const path of ['/dashboard', '/produtos', '/clientes', '/pdv', '/financeiro/caixas', '/financeiro/contas-pagar']) {
        const page = await pageFor(t), errors = [], files = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('request', r => { if (r.url().endsWith('.js')) files.push(r.url().split('/').pop()); });
        await page.route('http://localhost:8080/**', route => route.fulfill({ status: 503, json: { message: 'API sintética indisponível' } }));
        const start = performance.now();
        await page.goto(base + path);
        await expect(page.getByRole('status')).toHaveCount(0);
        await expect(page.getByText('Recarregar página', { exact: true })).toHaveCount(0);
        assert.equal(new URL(page.url()).pathname, path);
        assert.deepEqual(errors, []);
        timings.push({ path, readyMs: performance.now() - start, files: [...new Set(files)] });
        await page.close();
    }
    fs.writeFileSync(evidence + '/routes-runtime.json', JSON.stringify(timings, null, 2));
    const page = await pageFor(t);
    await page.goto(base + '/estoque');
    await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible();
    await page.evaluate(() => {
        const session = JSON.parse(localStorage.getItem('novexa-auth'));
        session.token = 'x.' + btoa(JSON.stringify({ exp: 1 })) + '.x';
        localStorage.setItem('novexa-auth', JSON.stringify(session));
        window.dispatchEvent(new Event('focus'));
    });
    await expect(page.getByRole('heading', { name: 'Acesso ao sistema' })).toBeVisible();
    assert.equal(await page.evaluate(() => localStorage.getItem('novexa-auth')), null);
});
