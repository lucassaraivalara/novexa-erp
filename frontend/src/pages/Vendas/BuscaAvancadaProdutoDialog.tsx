import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
    InputAdornment, MenuItem, Stack, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AppTable, { type Coluna } from "../../components/ui/AppTable";
import { SeletorClassificacaoProduto } from "../Produtos/ClassificacaoProdutoCampos";
import { semClassificacao, type ClassificacaoProduto } from "../Produtos/classificacaoProdutoUtils";
import { listarProdutosPaginado, obterMensagemDaApi } from "../../services/produtoService";
import type { Produto } from "../../types/produto";
import { moeda } from "./pdv";

type Props = {
    termoInicial: string;
    erroInclusao: string;
    onAdicionar: (produto: Produto) => boolean;
    onFechar: () => void;
};

export default function BuscaAvancadaProdutoDialog({ termoInicial, erroInclusao, onAdicionar, onFechar }: Props) {
    const [termo, setTermo] = useState(termoInicial);
    const [campo, setCampo] = useState("");
    const [situacao, setSituacao] = useState("ativos");
    const [estoque, setEstoque] = useState("");
    const [classificacao, setClassificacao] = useState<ClassificacaoProduto>(semClassificacao);
    const [pagina, setPagina] = useState(0);
    const [tamanho, setTamanho] = useState(10);
    const [ordem, setOrdem] = useState({ campo: "nome", direcao: "asc" as "asc" | "desc" });
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [total, setTotal] = useState(0);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [aviso, setAviso] = useState("");
    const [revisao, setRevisao] = useState(0);
    const buscaRef = useRef<HTMLInputElement>(null);
    const tabelaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const resposta = await listarProdutosPaginado({ busca: termo.trim() || undefined, campoBusca: campo || undefined,
                    situacao, situacaoEstoque: estoque || undefined, categoriaId: classificacao.categoria?.id,
                    marcaId: classificacao.marca?.id, page: pagina, size: tamanho, sort: `${ordem.campo},${ordem.direcao}` }, controller.signal);
                if (controller.signal.aborted) return;
                if (!Array.isArray(resposta.items)) throw new Error("Resposta de consulta inválida.");
                setProdutos(resposta.items); setTotal(resposta.totalItems); setErro("");
            } catch (e) {
                if (!controller.signal.aborted) {
                    setProdutos([]); setTotal(0); setErro(obterMensagemDaApi(e, "Não foi possível buscar os produtos. Tente novamente."));
                }
            } finally {
                if (!controller.signal.aborted) setCarregando(false);
            }
        }, termo.trim() ? 350 : 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [termo, campo, situacao, estoque, classificacao.categoria?.id, classificacao.marca?.id, pagina, tamanho, ordem, revisao]);

    function filtrar() { setPagina(0); setCarregando(true); setErro(""); setAviso(""); }
    function pesquisar() { filtrar(); setRevisao(r => r + 1); }
    function limpar() {
        setTermo(""); setCampo(""); setSituacao("ativos"); setEstoque(""); setClassificacao(semClassificacao);
        pesquisar(); buscaRef.current?.focus();
    }
    function adicionar(produto: Produto) {
        if (carregando || !produto.ativo) return;
        if (onAdicionar(produto)) setAviso(`${produto.nome} adicionado à venda.`);
    }
    function navegarResultados(evento: KeyboardEvent) {
        // Selects e autocompletes conservam a própria navegação por setas.
        if (evento.key !== "ArrowDown" && evento.key !== "ArrowUp") return;
        const alvo = evento.target as HTMLElement;
        if (alvo !== buscaRef.current && !alvo.closest("tbody")) return;
        const botoes = Array.from(tabelaRef.current?.querySelectorAll<HTMLButtonElement>("tbody button:not(:disabled)") ?? []);
        if (!botoes.length || carregando) return;
        evento.preventDefault();
        const atual = botoes.indexOf(alvo as HTMLButtonElement);
        const proximo = atual < 0 ? (evento.key === "ArrowDown" ? 0 : botoes.length - 1)
            : Math.max(0, Math.min(botoes.length - 1, atual + (evento.key === "ArrowDown" ? 1 : -1)));
        botoes[proximo].focus();
    }

    const colunas: Coluna<Produto>[] = [
        { campo: "nome", cabecalho: "Produto", ordenavel: true, render: (_, p) => <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
            {p.imagemUrl && <Box component="img" src={p.imagemUrl} alt="" width={36} height={36} loading="lazy" sx={{ objectFit: "contain", flexShrink: 0 }} />}
            <Box sx={{ minWidth: 0 }}><Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: "normal", overflowWrap: "anywhere" }}>{p.nome}</Typography>
                {(!p.ativo || p.composto) && <Typography variant="caption" color={p.ativo ? "text.secondary" : "error.main"}>{!p.ativo ? "Inativo · indisponível para venda" : "Kit/Combo"}</Typography>}
            </Box></Stack> },
        { campo: "codigoInterno", cabecalho: "Código", ordenavel: true, render: (_, p) => <Box>
            <Typography variant="body2">{p.codigoInterno || "—"}</Typography>
            {p.codigoBarras && <Typography variant="caption" color="text.secondary">{p.codigoBarras}</Typography>}</Box> },
        { campo: "categoria.nome", cabecalho: "Categoria", render: (_, p) => p.categoria?.nome || "—" },
        { campo: "marca.nome", cabecalho: "Marca", render: (_, p) => p.marca?.nome || "—" },
        { campo: "estoqueAtual", cabecalho: "Estoque", alinhar: "right", ordenavel: true, render: (_, p) => <Typography variant="body2"
            sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }} color={p.controlaEstoque && p.estoqueAtual <= 0 ? "warning.main" : "text.primary"}>
            {p.controlaEstoque ? `${p.estoqueAtual.toLocaleString("pt-BR")} ${p.unidadeMedida}` : "Sem controle"}</Typography> },
        { campo: "precoVenda", cabecalho: "Preço", alinhar: "right", ordenavel: true, render: (_, p) => <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{moeda(Math.round(p.precoVenda * 100))}</Typography> },
    ];

    return <Dialog open fullWidth maxWidth="lg" onClose={onFechar} aria-labelledby="pdv-busca-avancada-titulo"
        slotProps={{ paper: { sx: { m: { xs: 1, sm: 3 }, width: { xs: "calc(100% - 16px)", sm: "calc(100% - 48px)" }, maxHeight: "calc(100dvh - 32px)" },
            onKeyDown: (evento: KeyboardEvent<HTMLDivElement>) => {
                navegarResultados(evento);
                if (/^F[2-9]$/.test(evento.key)) evento.preventDefault();
                if (evento.ctrlKey && evento.key.toLowerCase() === "b") { evento.preventDefault(); buscaRef.current?.focus(); }
                if (evento.key !== "Escape") evento.stopPropagation();
            } } }}>
        <DialogTitle id="pdv-busca-avancada-titulo" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, py: 1.5 }}>
            <Typography component="span" variant="h6">Busca avançada de produtos</Typography>
            <IconButton aria-label="Fechar busca avançada" onClick={onFechar}><CloseRoundedIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 1.5, sm: 2 }, overscrollBehavior: "contain" }}>
            <Box component="form" onSubmit={e => { e.preventDefault(); pesquisar(); }} sx={{ mb: 2 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "180px minmax(0, 1fr) auto" }, gap: 1.25, mb: 1.5 }}>
                    <TextField select label="Pesquisar por" size="small" value={campo} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} onChange={e => { setCampo(e.target.value); filtrar(); }}>
                        <MenuItem value="">Nome ou códigos</MenuItem><MenuItem value="nome">Nome</MenuItem>
                        <MenuItem value="codigoInterno">Código interno</MenuItem><MenuItem value="codigoBarras">Código de barras / EAN</MenuItem>
                    </TextField>
                    <TextField label="Pesquisar produtos" placeholder="Nome, código interno ou EAN…" name="buscaProdutoAvancada" autoComplete="off" size="small" autoFocus inputRef={buscaRef}
                        value={termo} onChange={e => { setTermo(e.target.value); filtrar(); }}
                        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }, htmlInput: { spellCheck: false } }} />
                    <Button type="submit" variant="contained" startIcon={<SearchIcon />}>Buscar</Button>
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr)) auto" }, gap: 1.25, alignItems: "start" }}>
                    <SeletorClassificacaoProduto tipo="categoria" value={classificacao.categoria} onChange={categoria => { setClassificacao(c => ({ ...c, categoria })); filtrar(); }} />
                    <SeletorClassificacaoProduto tipo="marca" value={classificacao.marca} onChange={marca => { setClassificacao(c => ({ ...c, marca })); filtrar(); }} />
                    <TextField select label="Situação" size="small" value={situacao} onChange={e => { setSituacao(e.target.value); filtrar(); }}>
                        <MenuItem value="ativos">Ativos</MenuItem><MenuItem value="inativos">Inativos</MenuItem><MenuItem value="todos">Todos</MenuItem>
                    </TextField>
                    <TextField select label="Estoque" size="small" value={estoque} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} onChange={e => { setEstoque(e.target.value); filtrar(); }}>
                        <MenuItem value="">Todos</MenuItem><MenuItem value="normal">Acima do mínimo</MenuItem><MenuItem value="baixo">Baixo</MenuItem>
                        <MenuItem value="zerado">Zerado</MenuItem><MenuItem value="semControle">Sem controle</MenuItem>
                    </TextField>
                    <Button onClick={limpar} sx={{ minHeight: 40 }}>Limpar filtros</Button>
                </Box>
            </Box>
            {erro && <Alert severity="error" sx={{ mb: 1.5 }} action={<Button color="inherit" onClick={pesquisar}>Tentar novamente</Button>}>{erro}</Alert>}
            {erroInclusao && <Alert severity="error" sx={{ mb: 1.5 }}>{erroInclusao}</Alert>}
            <Box ref={tabelaRef} aria-label="Resultados da busca avançada" aria-busy={carregando}>
                <AppTable colunas={colunas} linhas={produtos} carregando={carregando} obterChaveLinha={p => p.id} compacta minWidth={650}
                    vazio={{ titulo: erro ? "Consulta indisponível" : "Nenhum produto encontrado", descricao: erro ? "Tente novamente para consultar o catálogo." : "Revise a pesquisa ou limpe os filtros." }}
                    acoes={[{ rotulo: "Adicionar produto", icone: <AddRoundedIcon />, cor: "primary", onClick: adicionar, desabilitado: p => !p.ativo || carregando }]}
                    ordenacaoRemota ordenacao={{ ...ordem, onSort: campo => { setOrdem(o => ({ campo, direcao: o.campo === campo && o.direcao === "asc" ? "desc" : "asc" })); filtrar(); } }}
                    paginacao={{ pagina, linhasPorPagina: tamanho, total, onPageChange: p => { setPagina(p); setCarregando(true); },
                        onRowsPerPageChange: n => { setTamanho(n); filtrar(); } }}
                    sx={{ "& .MuiTableContainer-root": { maxHeight: "min(42dvh, 420px)", overscrollBehavior: "contain" },
                        "& thead": { position: "sticky", top: 0, zIndex: 1 },
                        "& tbody .MuiIconButton-root": { width: 40, height: 40 },
                        "& td:nth-of-type(3), & th:nth-of-type(3), & td:nth-of-type(4), & th:nth-of-type(4)": { display: { xs: "none", md: "table-cell" } },
                        "& td:nth-of-type(3), & td:nth-of-type(4)": { maxWidth: 150 } }} />
            </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1, justifyContent: "space-between", gap: 1 }}>
            <Typography role="status" variant="body2" color="text.secondary" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                {aviso || "Use as setas e Enter para adicionar. Esc fecha a busca."}</Typography>
            <Button onClick={onFechar} sx={{ flexShrink: 0 }}>Voltar à venda</Button>
        </DialogActions>
    </Dialog>;
}
