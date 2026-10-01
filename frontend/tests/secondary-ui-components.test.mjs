import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "@mui/material/styles";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const [actionsModule, emptyModule, statModule] = await Promise.all([
    server.ssrLoadModule("/src/components/ui/FormActions.tsx"),
    server.ssrLoadModule("/src/components/ui/EmptyState.tsx"),
    server.ssrLoadModule("/src/components/ui/StatCard.tsx"),
]);
const { default: theme, visualTokens } = await server.ssrLoadModule("/src/theme/theme.ts");
await server.close();

const render = (element) => renderToStaticMarkup(createElement(ThemeProvider, { theme }, element));

test("CadastroDialog preserva títulos, conteúdo, ações e limites responsivos", async () => {
    const source = await readFile(new URL("../src/components/ui/CadastroDialog.tsx", import.meta.url), "utf8");

    assert.match(source, /titulo: string/);
    assert.match(source, /descricao\?: string/);
    assert.match(source, /children: ReactNode/);
    assert.match(source, /textoCancelar = "Cancelar"/);
    assert.match(source, /textoSalvar = "Salvar"/);
    assert.match(source, /<DialogTitle/);
    assert.match(source, /\{titulo\}/);
    assert.match(source, /\{descricao &&/);
    assert.match(source, /\{children\}/);
    assert.match(source, /aria-label="Fechar"/);
    assert.match(source, /<Button onClick=\{onFechar\} disabled=\{salvando\}>\{textoCancelar\}/);
    assert.match(source, /type="submit" variant="contained"/);
    assert.match(source, /borderRadius: \{ xs: 0, sm: `\$\{layoutTokens\.radius\.dialog\}px` \}/);
    assert.match(source, /maxHeight: \{ xs: "100%", sm: "84vh" \}/);
    assert.match(source, /maxWidth: \{ xs: "100%", sm: "calc\(100vw - 32px\)" \}/);
    assert.match(source, /overflowY: "auto"/);
});

test("CadastroDialog bloqueia fechamento e anuncia salvamento sem perder submit", async () => {
    const source = await readFile(new URL("../src/components/ui/CadastroDialog.tsx", import.meta.url), "utf8");

    assert.match(source, /aria-busy=\{salvando\}/);
    assert.match(source, /\{salvando \? "Salvando…" : textoSalvar\}/);
    assert.match(source, /onClose=\{salvando \? undefined : onFechar\}/);
    assert.match(source, /aria-label="Fechar" onClick=\{onFechar\} disabled=\{salvando\}/);
    assert.match(source, /disabled=\{salvando \|\| desabilitarSalvar\}/);
    assert.match(source, /fullScreen=\{telaPequena\}/);
});

test("FormActions preserva ordem, labels, submit e bloqueio durante loading", async () => {
    const labels = render(createElement(actionsModule.default, {
        onCancelar() {},
        tipoSalvar: "submit",
        textoCancelar: "Manter edição",
        textoSalvar: "Confirmar cadastro",
    })).replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
    const loading = render(createElement(actionsModule.default, {
        onCancelar() {},
        tipoSalvar: "submit",
        salvando: true,
    })).replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
    const disabled = render(createElement(actionsModule.default, {
        onCancelar() {},
        desabilitado: true,
        textoSalvar: "Salvar alterações",
    })).replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");

    assert.match(labels, /Manter edição[\s\S]*Confirmar cadastro/);
    assert.match(labels, /type="submit"/);
    assert.match(loading, /aria-busy="true"/);
    assert.match(loading, /disabled=""/);
    assert.match(loading, /Salvando\.\.\./);
    assert.match(disabled, /Salvar alterações/);
    assert.match(disabled, /disabled=""/);
    const source = await readFile(new URL("../src/components/ui/FormActions.tsx", import.meta.url), "utf8");
    assert.match(source, /onClick=\{onCancelar\}/);
    assert.match(source, /onClick=\{tipoSalvar === "submit" \? undefined : onSalvar\}/);
});

test("EmptyState apresenta título, descrição e ação opcional sem depender do ícone", () => {
    const html = render(createElement(emptyModule.default, {
        titulo: "Nenhum banco cadastrado",
        descricao: "Cadastre um banco para continuar.",
        icone: createElement("svg", null),
        acao: createElement("button", null, "Novo banco"),
    }));
    const semIcone = render(createElement(emptyModule.default, { titulo: "Sem resultados" }));

    assert.match(html, /Nenhum banco cadastrado/);
    assert.match(html, /Cadastre um banco para continuar\./);
    assert.match(html, /Novo banco/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(semIcone, /Sem resultados/);
});

test("StatCard mantém a API legada e aceita tone e ícone opcionais", () => {
    const neutro = render(createElement(statModule.default, { titulo: "Vendas", valor: 3 }));
    const legado = render(createElement(statModule.default, {
        titulo: "Faturamento hoje",
        valor: "R$ 10.250,00",
        descricao: "Vendas faturadas",
        cor: "primary",
    }));
    const tonalizado = render(createElement(statModule.default, {
        titulo: "Estoque baixo",
        valor: 12,
        descricao: "Produtos no mínimo ou abaixo",
        tone: "warning",
        icone: createElement("svg", null),
    }));

    assert.match(neutro, /#101828/i);
    assert.match(legado, /Faturamento hoje/);
    assert.match(legado, /R\$ 10\.250,00/);
    assert.match(legado, /Vendas faturadas/);
    assert.match(tonalizado, /Estoque baixo/);
    assert.match(tonalizado, />12</);
    assert.match(tonalizado, /Produtos no mínimo ou abaixo/);
    assert.match(tonalizado, /Atenção/);
    assert.match(tonalizado, /aria-hidden="true"/);
    assert.match(tonalizado, /#b25e09/i);
});

test("Cadastros usam raios moderados em px, elevacao leve e secoes sem caixas aninhadas", async () => {
    assert.deepEqual(visualTokens.radius, { control: 6, surface: 10, dialog: 10, pill: 999 });
    assert.equal(visualTokens.shadow.surface, "0 1px 3px rgba(16,24,40,.06)");
    assert.equal(theme.shape.borderRadius, 6);
    const dialog = await readFile(new URL("../src/components/ui/CadastroDialog.tsx", import.meta.url), "utf8");
    const filters = await readFile(new URL("../src/components/ui/PageFilters.tsx", import.meta.url), "utf8");
    assert.match(dialog, /boxShadow: "none"/);
    assert.match(dialog, /"& \.MuiPaper-outlined": \{ border: 0, borderBottom: 1/);
    assert.match(filters, /data-page-filters/);
    assert.match(filters, /borderRadius: `\$\{layoutTokens\.radius\.field\}px`/);
});
