import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import InputRoundedIcon from "@mui/icons-material/InputRounded";
import OutputRoundedIcon from "@mui/icons-material/OutputRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { useEffect, useMemo, useState } from "react";
import {
    Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, Stack, TextField, Typography,
} from "@mui/material";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import type { Produto } from "../../types/produto";
import {
    listarHistoricoProduto, listarProdutosEstoque, obterMensagemEstoque,
    registrarAjuste, registrarEntrada, registrarSaida, type MovimentacaoEstoque,
    type TipoMovimentacaoEstoque,
} from "../../services/estoqueService";
import { novoSaldoEsperado, situacaoEstoque, type SituacaoEstoque } from "./estoqueRegras";

const quantidadeFormatada = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const dataFormatada = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
type Operacao = TipoMovimentacaoEstoque;
type DialogoMovimentacao = { produto: Produto; operacao: Operacao } | null;

const coresSituacao: Record<SituacaoEstoque, "default" | "success" | "warning" | "error"> = {
    "SEM CONTROLE": "default", NORMAL: "success", BAIXO: "warning", ZERADO: "error",
};

function codigoProduto(produto: Produto): string {
    return produto.codigoInterno || produto.codigoBarras || "—";
}

export default function Estoque() {
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [busca, setBusca] = useState("");
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [dialogo, setDialogo] = useState<DialogoMovimentacao>(null);
    const [historicoProduto, setHistoricoProduto] = useState<Produto | null>(null);
    const [historico, setHistorico] = useState<MovimentacaoEstoque[]>([]);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);
    const [quantidade, setQuantidade] = useState("");
    const [motivo, setMotivo] = useState("");
    const [salvando, setSalvando] = useState(false);

    async function carregarProdutos() {
        setCarregando(true); setErro("");
        try { setProdutos(await listarProdutosEstoque()); }
        catch (e) { setErro(obterMensagemEstoque(e, "Não foi possível carregar o estoque.")); }
        finally { setCarregando(false); }
    }

    useEffect(() => {
        let ativo = true;
        listarProdutosEstoque()
            .then((dados) => { if (ativo) setProdutos(dados); })
            .catch((e) => { if (ativo) setErro(obterMensagemEstoque(e, "Não foi possível carregar o estoque.")); })
            .finally(() => { if (ativo) setCarregando(false); });
        return () => { ativo = false; };
    }, []);

    const produtosFiltrados = useMemo(() => {
        const termo = busca.trim().toLocaleLowerCase("pt-BR");
        if (!termo) return produtos;
        return produtos.filter((produto) => produto.nome.toLocaleLowerCase("pt-BR").includes(termo)
            || codigoProduto(produto).toLocaleLowerCase("pt-BR").includes(termo));
    }, [busca, produtos]);

    function abrirMovimentacao(produto: Produto, operacao: Operacao) {
        setErro(""); setQuantidade(""); setMotivo(""); setDialogo({ produto, operacao });
    }

    async function abrirHistorico(produto: Produto) {
        setHistoricoProduto(produto); setCarregandoHistorico(true); setErro("");
        try { setHistorico(await listarHistoricoProduto(produto.id)); }
        catch (e) { setHistorico([]); setErro(obterMensagemEstoque(e, "Não foi possível carregar o histórico.")); }
        finally { setCarregandoHistorico(false); }
    }

    async function confirmarMovimentacao() {
        if (!dialogo || salvando) return;
        const valor = Number(quantidade.replace(",", "."));
        if (!Number.isFinite(valor) || valor < 0 || (dialogo.operacao !== "AJUSTE" && valor <= 0)) {
            setErro(dialogo.operacao === "AJUSTE" ? "Informe um novo saldo físico válido." : "Informe uma quantidade maior que zero."); return;
        }
        setSalvando(true); setErro("");
        const dados = { produtoId: dialogo.produto.id, quantidade: valor, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) };
        try {
            if (dialogo.operacao === "ENTRADA") await registrarEntrada(dados);
            if (dialogo.operacao === "SAIDA") await registrarSaida(dados);
            if (dialogo.operacao === "AJUSTE") await registrarAjuste(dados);
            setDialogo(null); await carregarProdutos();
        } catch (e) { setErro(obterMensagemEstoque(e, "Não foi possível registrar a movimentação.")); }
        finally { setSalvando(false); }
    }

    const colunas: Coluna<Produto>[] = [
        { campo: "nome", cabecalho: "Produto", largura: 300 },
        { campo: "codigoInterno", cabecalho: "Código", largura: 150, render: (_valor, produto) => codigoProduto(produto) },
        { campo: "estoqueAtual", cabecalho: "Estoque atual", largura: 140, alinhar: "right", render: (valor) => quantidadeFormatada.format(Number(valor)) },
        { campo: "estoqueMinimo", cabecalho: "Estoque mínimo", largura: 140, alinhar: "right", render: (valor) => quantidadeFormatada.format(Number(valor)) },
        { campo: "controlaEstoque", cabecalho: "Situação", largura: 150, render: (_valor, produto) => { const situacao = situacaoEstoque(produto); return <Chip size="small" label={situacao} color={coresSituacao[situacao]} variant="outlined" />; } },
    ];

    const acoes: AcaoTabela<Produto>[] = [
        { rotulo: "Entrada", icone: <InputRoundedIcon fontSize="small" />, onClick: (produto) => abrirMovimentacao(produto, "ENTRADA"), desabilitado: (produto) => !produto.controlaEstoque || !produto.ativo, tooltip: "Registrar entrada" },
        { rotulo: "Saída", icone: <OutputRoundedIcon fontSize="small" />, onClick: (produto) => abrirMovimentacao(produto, "SAIDA"), desabilitado: (produto) => !produto.controlaEstoque || !produto.ativo, cor: "error", tooltip: "Registrar saída" },
        { rotulo: "Ajuste", icone: <TuneRoundedIcon fontSize="small" />, onClick: (produto) => abrirMovimentacao(produto, "AJUSTE"), desabilitado: (produto) => !produto.controlaEstoque || !produto.ativo, tooltip: "Ajustar novo saldo físico" },
        { rotulo: "Histórico", icone: <HistoryRoundedIcon fontSize="small" />, onClick: (produto) => void abrirHistorico(produto), tooltip: "Consultar histórico" },
    ];

    const operacao = dialogo?.operacao;
    const tituloOperacao = operacao === "AJUSTE" ? "Ajustar estoque" : operacao === "ENTRADA" ? "Registrar entrada" : "Registrar saída";
    const valor = Number(quantidade.replace(",", "."));
    const saldoEsperado = dialogo && Number.isFinite(valor) ? novoSaldoEsperado(operacao!, dialogo.produto.estoqueAtual, valor) : null;

    return <Stack spacing={2.5}>
        <PageHeader titulo="Estoque" descricao="Consulte saldos e registre movimentações operacionais." />
        {erro && <Alert severity="error" onClose={() => setErro("")}>{erro}</Alert>}
        <AppTable colunas={colunas} linhas={produtosFiltrados} carregando={carregando} obterChaveLinha={(produto) => produto.id}
            busca={{ placeholder: "Pesquisar por produto ou código", valor: busca, onChange: setBusca }}
            vazio={{ titulo: "Nenhum produto encontrado", descricao: busca ? "Tente outro nome ou código." : "Cadastre produtos para acompanhar o estoque." }}
            acoes={acoes} minWidth={980} />

        <Dialog open={dialogo !== null} onClose={salvando ? undefined : () => setDialogo(null)} fullWidth maxWidth="xs">
            <DialogTitle>{tituloOperacao}</DialogTitle>
            <DialogContent>{dialogo && <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField label="Produto" value={`${dialogo.produto.nome} · ${codigoProduto(dialogo.produto)}`} slotProps={{ input: { readOnly: true } }} />
                <Typography variant="body2" color="text.secondary">Saldo atual: <strong>{quantidadeFormatada.format(dialogo.produto.estoqueAtual)}</strong></Typography>
                <TextField autoFocus required label={operacao === "AJUSTE" ? "Novo saldo físico" : "Quantidade"} value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void confirmarMovimentacao(); } }} slotProps={{ htmlInput: { inputMode: "decimal", min: 0 } }} />
                <TextField label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} multiline minRows={2} />
                {saldoEsperado !== null && <Typography variant="body2" color="text.secondary">Novo saldo esperado: <strong>{quantidadeFormatada.format(saldoEsperado)}</strong></Typography>}
            </Stack>}</DialogContent>
            <DialogActions><Button onClick={() => setDialogo(null)} disabled={salvando}>Cancelar</Button><Button variant="contained" onClick={() => void confirmarMovimentacao()} disabled={salvando}>{salvando ? "Registrando..." : "Confirmar"}</Button></DialogActions>
        </Dialog>

        <Dialog open={historicoProduto !== null} onClose={() => setHistoricoProduto(null)} fullWidth maxWidth="md">
            <DialogTitle>Histórico de movimentações{historicoProduto ? ` · ${historicoProduto.nome}` : ""}</DialogTitle>
            <DialogContent>{carregandoHistorico ? <Typography color="text.secondary">Carregando histórico...</Typography> : historico.length === 0 ? <Typography color="text.secondary">Nenhuma movimentação encontrada.</Typography> : <Stack divider={<Divider />}>
                {historico.map((movimentacao) => <Stack key={movimentacao.id} spacing={0.5} sx={{ py: 1.5 }}>
                    <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}><Typography sx={{ fontWeight: 700 }}>{movimentacao.tipo} · {movimentacao.origem}</Typography><Typography variant="body2" color="text.secondary">{dataFormatada.format(new Date(movimentacao.dataHora))}</Typography></Stack>
                    <Typography variant="body2">Saldo: {quantidadeFormatada.format(movimentacao.saldoAnterior)} → {quantidadeFormatada.format(movimentacao.saldoPosterior)} · Valor: {quantidadeFormatada.format(movimentacao.quantidade)}</Typography>
                    <Typography variant="body2" color="text.secondary">{movimentacao.motivo || "Sem motivo informado"} · {movimentacao.nomeUsuario}</Typography>
                </Stack>)}
            </Stack>}</DialogContent>
            <DialogActions><Button onClick={() => setHistoricoProduto(null)}>Fechar</Button></DialogActions>
        </Dialog>
    </Stack>;
}
