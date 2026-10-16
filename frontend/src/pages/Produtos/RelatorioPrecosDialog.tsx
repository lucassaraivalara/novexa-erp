import { useEffect, useRef, useState } from "react";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import {
    Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControl, InputLabel, MenuItem, Select, Stack, Typography,
} from "@mui/material";
import AppTable, { type Coluna } from "../../components/ui/AppTable";
import PageFilters from "../../components/ui/PageFilters";
import { listarProdutosPaginado, obterMensagemDaApi } from "../../services/produtoService";
import type { Produto } from "../../types/produto";
import { obterEmpresaAtiva } from "../../utils/auth/sessao";
import { imprimirRelatorioPrecos } from "./imprimirRelatorioPrecos";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const nomesOrdenacao: Record<string, string> = {
    nome: "Produto", codigoInterno: "Código interno / SKU", precoVenda: "Preço de venda", ativo: "Situação",
};

export default function RelatorioPrecosDialog({ onFechar }: { onFechar: () => void }) {
    const empresaId = obterEmpresaAtiva()?.id;
    const [busca, setBusca] = useState("");
    const [campoBusca, setCampoBusca] = useState("nome");
    const [situacao, setSituacao] = useState("ativos");
    const [pagina, setPagina] = useState(0);
    const [tamanho, setTamanho] = useState(25);
    const [ordenacao, setOrdenacao] = useState({ campo: "nome", direcao: "asc" as "asc" | "desc" });
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [total, setTotal] = useState(0);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [revisao, setRevisao] = useState(0);
    const [progresso, setProgresso] = useState("");
    const impressao = useRef<AbortController | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            if (!empresaId) { setErro("Entre novamente para consultar os produtos."); setCarregando(false); return; }
            setCarregando(true);
            listarProdutosPaginado({ busca, campoBusca: busca.trim() ? campoBusca : undefined, situacao, page: pagina, size: tamanho,
                sort: `${ordenacao.campo},${ordenacao.direcao}` }, controller.signal)
                .then(resposta => {
                    if (controller.signal.aborted) return;
                    setProdutos(resposta.items); setTotal(resposta.totalItems); setErro("");
                    if (pagina > 0 && !resposta.items.length) setPagina(Math.max(0, resposta.totalPages - 1));
                })
                .catch(e => {
                    if (!controller.signal.aborted) setErro(obterMensagemDaApi(e, "Não foi possível consultar os preços."));
                })
                .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        }, busca.trim() ? 350 : 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [empresaId, busca, campoBusca, situacao, pagina, tamanho, ordenacao, revisao]);

    useEffect(() => () => impressao.current?.abort(), [empresaId]);

    function fechar() { impressao.current?.abort(); onFechar(); }

    async function imprimir() {
        if (impressao.current) return;
        const controller = new AbortController();
        impressao.current = controller;
        setErro("");
        setProgresso("Preparando todos os produtos filtrados…");
        const descricao = `${campoBusca === "nome" ? "Nome" : "Código interno / SKU"}: ${busca.trim() || "todos"}`
            + ` · Situação: ${situacao === "ativos" ? "Ativos" : situacao === "inativos" ? "Inativos" : "Todas"}`
            + ` · Ordem: ${nomesOrdenacao[ordenacao.campo]} (${ordenacao.direcao === "asc" ? "crescente" : "decrescente"})`;
        try {
            await imprimirRelatorioPrecos({ busca, campoBusca: busca.trim() ? campoBusca : undefined, situacao,
                sort: `${ordenacao.campo},${ordenacao.direcao}` }, descricao, controller.signal, setProgresso);
        } catch (e) {
            if (!controller.signal.aborted) setErro(obterMensagemDaApi(e,
                e instanceof Error ? e.message : "Não foi possível preparar a impressão."));
        } finally {
            impressao.current = null;
            if (!controller.signal.aborted) setProgresso("");
        }
    }

    const colunas: Coluna<Produto>[] = [
        { campo: "nome", cabecalho: "Produto", ordenavel: true },
        { campo: "codigoInterno", cabecalho: "Código interno / SKU", ordenavel: true, render: v => String(v ?? "—") },
        { campo: "unidadeMedida", cabecalho: "Unidade" },
        { campo: "precoVenda", cabecalho: "Preço de venda", ordenavel: true, alinhar: "right", render: v => moeda.format(Number(v)) },
        { campo: "precoCusto", cabecalho: "Custo", alinhar: "right", render: v => moeda.format(Number(v)) },
        { campo: "ativo", cabecalho: "Situação", ordenavel: true,
            render: v => <Chip size="small" label={v ? "Ativo" : "Inativo"} color={v ? "success" : "default"} variant="outlined" /> },
    ];

    return (
        <Dialog open onClose={fechar} fullWidth maxWidth="lg" aria-labelledby="relatorio-precos-titulo"
            slotProps={{ paper: { sx: { m: { xs: 1, sm: 3 }, width: { xs: "calc(100% - 16px)", sm: "100%" }, maxHeight: "calc(100% - 16px)" } } }}>
            <DialogTitle id="relatorio-precos-titulo">Relatório de preços de Produtos</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography color="text.secondary" variant="body2">
                        Consulte os preços cadastrados. A impressão inclui todos os produtos dos filtros, na ordem escolhida, com os custos internos.
                    </Typography>
                    {erro && <Alert severity="error" action={<Button size="small" color="inherit" onClick={() => setRevisao(v => v + 1)}>Consultar novamente</Button>}>{erro}</Alert>}
                    <PageFilters busca={{ valor: busca, placeholder: campoBusca === "nome" ? "Pesquisar por nome…" : "Pesquisar por código interno / SKU…",
                        carregando, onChange: valor => { setBusca(valor); setPagina(0); } }}>
                        <FormControl size="small" sx={{ minWidth: 170 }} disabled={!!progresso}>
                            <InputLabel id="relatorio-precos-campo">Pesquisar em</InputLabel>
                            <Select labelId="relatorio-precos-campo" label="Pesquisar em" value={campoBusca}
                                onChange={e => { setCampoBusca(e.target.value); setPagina(0); }}>
                                <MenuItem value="nome">Nome</MenuItem>
                                <MenuItem value="codigoInterno">Código interno / SKU</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 140 }} disabled={!!progresso}>
                            <InputLabel id="relatorio-precos-situacao">Situação</InputLabel>
                            <Select labelId="relatorio-precos-situacao" label="Situação" value={situacao}
                                onChange={e => { setSituacao(e.target.value); setPagina(0); }}>
                                <MenuItem value="ativos">Ativos</MenuItem>
                                <MenuItem value="inativos">Inativos</MenuItem>
                                <MenuItem value="todos">Todas</MenuItem>
                            </Select>
                        </FormControl>
                    </PageFilters>
                    {progresso && <Alert severity="info" role="status">{progresso} Os filtros usados na impressão são os do início da consulta.</Alert>}
                    <AppTable colunas={colunas} linhas={produtos} carregando={carregando} compacta minWidth={820}
                        obterChaveLinha={p => p.id} ordenacaoRemota
                        vazio={{ titulo: "Nenhum produto encontrado", descricao: "Ajuste o nome, código interno ou situação." }}
                        ordenacao={{ ...ordenacao, onSort: campo => {
                            setPagina(0);
                            setOrdenacao(atual => ({ campo, direcao: atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc" }));
                        } }}
                        paginacao={{ pagina, linhasPorPagina: tamanho, total, onPageChange: setPagina,
                            onRowsPerPageChange: valor => { setTamanho(valor); setPagina(0); }, opcoesLinhasPorPagina: [10, 25, 50] }} />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, flexWrap: "wrap", gap: 1 }}>
                <Button onClick={fechar}>{progresso ? "Cancelar e fechar" : "Voltar aos produtos"}</Button>
                <Button variant="contained" startIcon={<PrintOutlinedIcon />} disabled={!!progresso || !empresaId}
                    onClick={() => void imprimir()}>{progresso ? "Preparando…" : "Preparar impressão / PDF"}</Button>
            </DialogActions>
        </Dialog>
    );
}
