import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

let server;
let browser;
let url;
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider,CssBaseline} from '@mui/material';
import {BrowserRouter,Routes,Route} from 'react-router-dom';
import Login from '/src/pages/Login/Login.tsx';
import theme from '/src/theme/theme.ts';
createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme},
    React.createElement(CssBaseline),React.createElement(BrowserRouter,null,
    React.createElement(Routes,null,
        React.createElement(Route,{path:'/login',element:React.createElement(Login)}),
        React.createElement(Route,{path:'/dashboard',element:React.createElement('h1',null,'Dashboard')})))));
`;

before(async () => {
    server = await createServer({
        cacheDir: "node_modules/.vite-login-tests",
        server: {host: "127.0.0.1", port: 0, hmr: false},
        plugins: [{
            name: "login-test-fixture",
            resolveId(id) { if (id === "/login-fixture.js") return "\0login-fixture.js"; },
            load(id) { if (id === "\0login-fixture.js") return fixture; },
            configureServer(vite) {
                vite.middlewares.use(async (req, res, next) => {
                    if (!["/login", "/dashboard"].includes(req.url)) return next();
                    res.setHeader("Content-Type", "text/html");
                    res.end(await vite.transformIndexHtml(req.url, '<div id="root"></div><script type="module" src="/login-fixture.js"></script>'));
                });
            },
        }],
    });
    await server.listen();
    url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({headless: true});
});
after(async () => { await browser?.close(); await server?.close(); });

async function withLogin(run) {
    const page = await browser.newPage({viewport: {width: 1440, height: 960}});
    try {
        await page.goto(`${url}/login`);
        await page.getByRole("heading", {name: "Acesso ao sistema"}).waitFor();
        await run(page);
    } finally { await page.close(); }
}

test("Login preserva rotulos, senha visivel e controles sem fluxo configurado", () => withLogin(async page => {
    const cpf = page.getByLabel("CPF", {exact: true});
    assert.equal(await cpf.evaluate(input => document.activeElement === input), true);
    await cpf.fill("52998224725");
    assert.equal(await cpf.inputValue(), "529.982.247-25");
    const password = page.getByLabel("Senha", {exact: true});
    await password.fill("minha-senha");
    assert.equal(await password.getAttribute("type"), "password");
    await page.getByRole("button", {name: "Mostrar senha"}).click();
    assert.equal(await password.getAttribute("type"), "text");
    await page.getByRole("button", {name: "Ocultar senha"}).click();
    assert.equal(await password.inputValue(), "minha-senha");
    assert.equal(await password.getAttribute("type"), "password");
    assert.equal(await page.getByRole("button", {name: "Esqueci minha senha"}).isDisabled(), true);
    assert.equal(await page.getByRole("button", {name: "Fale com o suporte"}).isDisabled(), true);
    assert.equal(await page.getByRole("checkbox", {name: "Manter conectado"}).isChecked(), true);
    assert.equal(await page.getByRole("checkbox", {name: "Manter conectado"}).isDisabled(), true);
}));

test("Login preserva validacao, erro HTTP, payload, sessao e redirecionamento", () => withLogin(async page => {
    const requests = [];
    await page.route("**/auth/login", async route => {
        requests.push(route.request().postDataJSON());
        await route.fulfill({status: requests.length === 1 ? 401 : 200, json: requests.length === 1 ? {} : {
            id: 7, nomeUsuario: "Maria", cpf: "52998224725", perfil: "ADMIN",
            empresa: {id: 1, nomeFantasia: "Loja teste"}, token: "token-teste",
        }});
    });
    await page.getByRole("button", {name: "Acessar", exact: true}).click();
    await page.getByText("Informe um CPF válido.", {exact: true}).waitFor();
    assert.equal(requests.length, 0);
    await page.getByLabel("CPF", {exact: true}).fill("52998224725");
    await page.getByRole("button", {name: "Acessar", exact: true}).click();
    await page.getByRole("alert").filter({hasText: "Informe sua senha."}).waitFor();
    await page.getByLabel("Senha", {exact: true}).fill("senha-segura");
    await page.getByRole("button", {name: "Acessar", exact: true}).click();
    await page.getByRole("alert").filter({hasText: "CPF ou senha inválidos."}).waitFor();
    assert.equal(await page.getByLabel("Senha", {exact: true}).inputValue(), "senha-segura");
    await page.getByRole("button", {name: "Acessar", exact: true}).click();
    await page.getByRole("heading", {name: "Dashboard"}).waitFor();
    assert.deepEqual(requests, [{cpf: "52998224725", senha: "senha-segura"}, {cpf: "52998224725", senha: "senha-segura"}]);
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem("novexa-auth")));
    assert.equal(session.token, "token-teste");
    assert.equal(session.empresa.id, 1);
}));

test("Login evita duplo submit durante carregamento", () => withLogin(async page => {
    let release;
    let requests = 0;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route("**/auth/login", async route => {
        requests++;
        await gate;
        await route.fulfill({status: 401, json: {}});
    });
    await page.getByLabel("CPF", {exact: true}).fill("52998224725");
    await page.getByLabel("Senha", {exact: true}).fill("senha");
    await page.getByRole("button", {name: "Acessar", exact: true}).click();
    const loading = page.getByRole("button", {name: "Entrando..."});
    await loading.waitFor();
    assert.equal(await loading.isDisabled(), true);
    await page.getByLabel("Senha", {exact: true}).press("Enter");
    release();
    await page.getByRole("alert").waitFor();
    assert.equal(requests, 1);
}));

test("Login responsivo mantém formulario prioritario, marca e ausência de overflow", () => withLogin(async page => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const width of [1440, 1024, 390]) {
        await page.setViewportSize({width, height: 960});
        const measurements = await page.evaluate(() => {
            const card = document.querySelector(".login-card").getBoundingClientRect();
            const aside = document.querySelector("aside").getBoundingClientRect();
            return {width: document.documentElement.scrollWidth, card: {x: card.x, y: card.y, bottom: card.bottom}, aside: {x: aside.x, y: aside.y},
                button: getComputedStyle(document.querySelector(".login-submit")).backgroundColor};
        });
        assert.ok(measurements.width <= width);
        assert.equal(measurements.button, "rgb(14, 124, 102)");
        assert.equal(await page.getByRole("img", {name: "Símbolo N Novexa"}).count(), 2);
        if (width < 900) assert.ok(measurements.card.bottom <= measurements.aside.y);
        else assert.ok(measurements.card.x > measurements.aside.x);
        await page.screenshot({path: join(tmpdir(), `novexa-login-${width}.png`), fullPage: true});
    }
    assert.deepEqual(errors, []);
}));
