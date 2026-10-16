import { listarProdutosPaginado, type FiltrosProduto } from "../../services/produtoService";
import type { Produto } from "../../types/produto";
import { obterSessao } from "../../utils/auth/sessao";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Relatório fixo: percorre a consulta paginada, sem reutilizar apenas a página da tela. */
export async function imprimirRelatorioPrecos(
    filtros: FiltrosProduto,
    descricao: string,
    signal: AbortSignal,
    onProgresso: (mensagem: string) => void,
): Promise<void> {
    const sessao = obterSessao();
    if (!sessao?.token || !sessao.empresa?.id) throw new Error("Entre novamente para gerar o relatório.");
    const { empresa, token } = sessao;
    // Abrir antes do primeiro await preserva o gesto do usuário para o bloqueador de pop-ups.
    const janela = window.open("", "_blank");
    if (!janela) throw new Error("Permita abrir uma nova janela para imprimir o relatório.");
    janela.opener = null;
    const fechar = () => janela.close();
    signal.addEventListener("abort", fechar, { once: true });
    const documento = janela.document;
    documento.title = "Relatório de preços — Novexa";
    documento.documentElement.lang = "pt-BR";
    const aviso = documento.createElement("p");
    aviso.textContent = "Carregando todos os produtos filtrados. Aguarde…";
    documento.body.replaceChildren(aviso);

    function conferirSessao() {
        signal.throwIfAborted();
        const atual = obterSessao();
        if (atual?.token !== token || atual?.empresa?.id !== empresa.id) {
            throw new Error("A sessão mudou. Abra novamente o relatório na empresa atual.");
        }
        if (janela.closed) throw new Error("A janela de impressão foi fechada.");
    }

    try {
        const produtos: Produto[] = [];
        const ids = new Set<number>();
        let total = -1;
        let paginas = 1;
        for (let page = 0; page < paginas; page++) {
            conferirSessao();
            const resposta = await listarProdutosPaginado({ ...filtros, page, size: 100 }, signal);
            conferirSessao();
            if (total < 0) { total = resposta.totalItems; paginas = resposta.totalPages; }
            if (resposta.totalItems !== total || resposta.totalPages !== paginas
                || (total > 0 && resposta.items.length === 0)) {
                throw new Error("O catálogo mudou durante a consulta. Gere o relatório novamente.");
            }
            for (const produto of resposta.items) {
                if (produto.empresaId !== empresa.id) throw new Error("Produto indisponível para esta empresa.");
                if (ids.has(produto.id)) throw new Error("O catálogo mudou durante a consulta. Gere o relatório novamente.");
                ids.add(produto.id);
                produtos.push(produto);
            }
            const mensagem = `Carregados ${produtos.length} de ${total} produtos…`;
            aviso.textContent = mensagem;
            onProgresso(mensagem);
        }
        if (produtos.length !== total) throw new Error("Consulta incompleta. Gere o relatório novamente.");
        if (!produtos.length) throw new Error("Nenhum produto encontrado para os filtros informados.");
        conferirSessao();

        const estilo = documento.createElement("style");
        estilo.textContent = `
            @page { size: A4 landscape; margin: 12mm; }
            body { font: 12px Arial, sans-serif; color: #15283f; margin: 24px; }
            h1 { font-size: 20px; margin-bottom: 8px; }
            p { overflow-wrap: anywhere; }
            table { border-collapse: collapse; width: 100%; table-layout: fixed; }
            th, td { border-bottom: 1px solid #ccd3da; padding: 7px; text-align: left; overflow-wrap: anywhere; }
            th { background: #edf3f1; }
            th:first-child { width: 30%; }
            th:nth-child(4), th:nth-child(5), td:nth-child(4), td:nth-child(5) { text-align: right; }
            thead { display: table-header-group; }
            tr { break-inside: avoid; }
            button { padding: 9px 14px; margin-bottom: 12px; cursor: pointer; }
            @media print { body { margin: 0; } .acoes { display: none; } }
        `;
        documento.head.append(estilo);
        function texto(tag: string, valor: string, pai: HTMLElement = documento.body) {
            const elemento = documento.createElement(tag);
            elemento.textContent = valor;
            pai.append(elemento);
            return elemento;
        }
        documento.body.replaceChildren();
        const acoes = texto("div", "");
        acoes.className = "acoes";
        const botao = documento.createElement("button");
        botao.textContent = "Imprimir / Salvar como PDF";
        botao.onclick = () => {
            try { conferirSessao(); janela.focus(); janela.print(); }
            catch { janela.close(); }
        };
        acoes.append(botao);
        texto("p", "Todos os produtos filtrados foram carregados. Use a impressão do navegador para imprimir ou salvar como PDF.", acoes);
        texto("h1", "Relatório de preços de Produtos");
        texto("p", empresa.nomeFantasia || empresa.razaoSocial);
        texto("p", `${descricao} · ${produtos.length} produtos · Consultado em ${new Date().toLocaleString("pt-BR")}`);
        const tabela = documento.createElement("table");
        documento.body.append(tabela);
        const cabecalho = texto("tr", "", texto("thead", "", tabela));
        for (const titulo of ["Produto", "Código interno / SKU", "Unidade", "Preço de venda", "Custo", "Situação"]) {
            const coluna = texto("th", titulo, cabecalho);
            coluna.setAttribute("scope", "col");
        }
        const corpo = texto("tbody", "", tabela);
        for (const produto of produtos) {
            const linha = texto("tr", "", corpo);
            for (const valor of [produto.nome, produto.codigoInterno ?? "—", produto.unidadeMedida,
                moeda.format(produto.precoVenda), moeda.format(produto.precoCusto), produto.ativo ? "Ativo" : "Inativo"]) {
                texto("td", valor, linha);
            }
        }
        janela.focus();
        botao.focus();
    } catch (erro) {
        janela.close();
        throw erro;
    } finally {
        signal.removeEventListener("abort", fechar);
    }
}
