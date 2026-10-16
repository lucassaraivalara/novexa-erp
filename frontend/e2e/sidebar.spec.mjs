import { test, expect } from "@playwright/test";

for (const viewport of [{width:1440,height:900},{width:1024,height:768},{width:390,height:844},{width:390,height:320}]) {
    test.describe('Navegação ' + viewport.width + 'x' + viewport.height, () => {
        test.use({viewport});
        test.beforeEach(async ({page}) => {
            await page.addInitScript(() => localStorage.setItem("novexa-auth",JSON.stringify({
                id:1,nomeUsuario:"Operador Teste",perfil:"ADMIN",empresa:{id:1,nomeFantasia:"Empresa Teste"},token:"sidebar-e2e",
            })));
            await page.route("**/*",route => {
                if (!["fetch","xhr"].includes(route.request().resourceType())) return route.continue();
                const path = new URL(route.request().url()).pathname;
                const data = path === "/dashboard/resumo" ? {
                    faturamentoHoje:0,quantidadeVendasHoje:0,ticketMedioHoje:0,quantidadeProdutosEstoqueBaixo:0,quantidadeClientesAtivos:0,sessoesCaixaAbertas:[],
                } : path.endsWith("/pagina") || ["/clientes","/produtos","/vendas"].includes(path)
                    ? {items:[],page:0,size:25,totalItems:0,totalPages:0} : [];
                return route.fulfill({json:data});
            });
            await page.goto("/dashboard");
        });

        test("central, destinos existentes e retorno direto ao Dashboard", async ({page}) => {
            const nav = page.getByRole("navigation",{name:"Menu principal"});
            const config = nav.getByRole("link",{name:viewport.width < 600 ? "Configurações (ícone)" : "Configurações",exact:true});
            await config.scrollIntoViewIfNeeded();
            await config.focus();
            await page.keyboard.press("Enter");
            await expect.poll(() => new URL(page.url()).pathname).toBe("/configuracoes");
            await expect(nav.getByRole("region")).toHaveCount(0);
            const main = page.getByRole("main");
            await expect(main.getByRole("heading",{level:2})).toHaveText(["Empresa","Usuários e acesso","Financeiro"]);
            for (const [label,path] of [["Empresas","/empresa"],["Usuários","/usuarios"],["Formas de pagamento","/financeiro/formas-pagamento"],["Dados bancários","/financeiro/dados-bancarios"]]) {
                await main.getByRole("link",{name:new RegExp(label)}).click();
                await expect.poll(() => new URL(page.url()).pathname).toBe(path);
                await expect(config).toHaveAttribute("aria-current","true");
                await page.getByRole("link",{name:"Voltar às configurações",exact:true}).click();
                await expect(main.getByRole("heading",{name:"Configurações",exact:true})).toBeVisible();
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            await nav.getByRole("link",{name:viewport.width < 600 ? "Visão geral (ícone)" : "Visão geral",exact:true}).click();
            await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");
            await expect(nav.getByRole("region")).toHaveCount(0);
            await expect(nav.getByRole("link",{name:"Vender (ícone)",exact:true})).toHaveAttribute("href","/pdv");
        });
    });
}
