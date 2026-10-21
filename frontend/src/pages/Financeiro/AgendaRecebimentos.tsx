import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Link, Stack, Typography } from "@mui/material";
import AppTable, { type Coluna } from "../../components/ui/AppTable";
import { consultarItensAgenda, listarAgendaRecebimentos, liquidarLoteRecebiveis, mensagemRecebivel } from "../../services/recebivelService";
import { consultarConfiguracaoRecebimentos } from "../../services/configuracaoRecebimentosService";
import { podeExecutarAcaoGerencial } from "../../utils/auth/perfis";
import { obterSessao } from "../../utils/auth/sessao";
import type { GrupoAgenda, ItemAgenda } from "../../types/recebivel";
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const data = (valor: string | null) => valor ? new Date(`${valor}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data prevista";
export default function AgendaRecebimentos({ onFechar, onAlterado }: { onFechar: () => void; onAlterado: () => void }) {
    const [grupos, setGrupos] = useState<GrupoAgenda[]>([]);
    const [pagina, setPagina] = useState(0);
    const [total, setTotal] = useState(0);
    const [versao, setVersao] = useState(0);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [aviso, setAviso] = useState("");
    const [simples, setSimples] = useState(false);
    const [selecionado, setSelecionado] = useState<GrupoAgenda | null>(null);
    const [itens, setItens] = useState<ItemAgenda[]>([]);
    const [preparando, setPreparando] = useState(false);
    const [erroLote, setErroLote] = useState("");
    const [processando, setProcessando] = useState(false);
    const enviando = useRef(false);
    const podeLiquidar = simples && podeExecutarAcaoGerencial(obterSessao()?.perfil);
    useEffect(() => {
        const controller = new AbortController();
        Promise.all([listarAgendaRecebimentos(pagina, 25, controller.signal), consultarConfiguracaoRecebimentos(controller.signal)])
            .then(([r, p]) => { if (!controller.signal.aborted) { setGrupos(r.items); setTotal(r.totalItems); setSimples(p.modo === "SIMPLIFICADO"); setErro("");
                if (pagina > 0 && !r.items.length) setPagina(Math.max(0, r.totalPages - 1)); } })
            .catch(e => { if (!controller.signal.aborted) { setGrupos([]); setErro(mensagemRecebivel(e, "Não foi possível carregar a agenda.")); } })
            .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        return () => controller.abort();
    }, [pagina, versao]);
    useEffect(() => {
        if (!selecionado) return;
        const controller = new AbortController();
        consultarItensAgenda(selecionado, controller.signal).then(r => { if (!controller.signal.aborted) setItens(r.items); })
            .catch(e => { if (!controller.signal.aborted) setErroLote(mensagemRecebivel(e, "Não foi possível preparar o lote. Feche e selecione novamente.")); })
            .finally(() => { if (!controller.signal.aborted) setPreparando(false); });
        return () => controller.abort();
    }, [selecionado]);
    async function confirmar() {
        if (!podeLiquidar || preparando || !itens.length || itens.some(i => i.liquido == null) || enviando.current) return;
        enviando.current = true; setProcessando(true); setErroLote("");
        try { await liquidarLoteRecebiveis(itens.map(i => i.id)); setSelecionado(null); setAviso(`${itens.length} recebíveis liquidados. Cada recebível mantém seu movimento individual.`);
            setCarregando(true); setVersao(v => v + 1); onAlterado(); }
        catch (e) { setErroLote(mensagemRecebivel(e, "Não foi possível liquidar o lote. Nenhum item foi parcialmente confirmado.")); }
        finally { enviando.current = false; setProcessando(false); }
    }
    const colunas: Coluna<GrupoAgenda>[] = [
        { campo: "dataPrevista", cabecalho: "Previsão", render: (_, g) => data(g.dataPrevista) },
        { campo: "configuracaoNome", cabecalho: "Pagamento e destino", render: (_, g) => <Box sx={{ overflowWrap: "anywhere" }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{g.configuracaoNome || `${g.tipo} · legado`}</Typography>
            <Typography variant="caption" color="text.secondary">{g.contaDestinoNome || "Sem destino histórico"}</Typography></Box> },
        { campo: "quantidade", cabecalho: "Recebíveis", alinhar: "right" },
        { campo: "bruto", cabecalho: "Bruto", alinhar: "right", render: (_, g) => moeda.format(g.bruto) },
        { campo: "taxas", cabecalho: "Taxas", alinhar: "right", render: (_, g) => g.taxas == null ? "—" : moeda.format(g.taxas) },
        { campo: "liquido", cabecalho: "Líquido previsto", alinhar: "right", render: (_, g) => g.semPrevisaoLiquida || g.liquido == null ? "Previsão incompleta" : moeda.format(g.liquido) },
        { campo: "tipo", cabecalho: "Ação", render: (_, g) => podeLiquidar ? <Button size="small" disabled={!g.contaDestinoId || !!g.semPrevisaoLiquida}
            onClick={() => { setPreparando(true); setItens([]); setErroLote(""); setSelecionado(g); }}>Confirmar recebimento</Button> : <Typography variant="caption">Consulta</Typography> },
    ];
    return <Dialog open fullWidth maxWidth="lg" onClose={processando ? undefined : onFechar} aria-labelledby="agenda-recebimentos-titulo">
        <DialogTitle id="agenda-recebimentos-titulo">Agenda de recebimentos</DialogTitle>
        <DialogContent dividers><Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">Data prevista não é dinheiro recebido. Confirme somente o recebimento efetivo. O fechamento do Caixa não liquida cartões.</Typography>
            {!simples && !carregando && <Alert severity="info">No modo Controlado, use a liquidação individual na consulta de recebimentos de cartão.</Alert>}
            {erro && <Alert severity="error" action={<Button color="inherit" onClick={() => { setCarregando(true); setVersao(v => v + 1); }}>Tentar novamente</Button>}>{erro}</Alert>}
            {aviso && <Alert role="status" severity="success">{aviso}</Alert>}
            <AppTable colunas={colunas} linhas={grupos} carregando={carregando} compacta minWidth={900}
                obterChaveLinha={g => `${g.dataPrevista}:${g.configuracaoId}:${g.tipo}:${g.contaDestinoId}`}
                vazio={{ titulo: "Nenhum recebimento pendente", descricao: "Novas previsões de cartão aparecerão aqui após as vendas." }}
                paginacao={{ pagina, linhasPorPagina: 25, total, onPageChange: p => { setCarregando(true); setPagina(p); }, onRowsPerPageChange: () => {}, opcoesLinhasPorPagina: [25] }} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={onFechar} disabled={processando}>Fechar agenda</Button></DialogActions>
        <Dialog open={selecionado !== null} fullWidth maxWidth="sm" onClose={processando ? undefined : () => setSelecionado(null)} aria-labelledby="agenda-lote-titulo">
            <Box component="form" onSubmit={e => { e.preventDefault(); void confirmar(); }}>
                <DialogTitle id="agenda-lote-titulo">Confirmar recebimento do lote?</DialogTitle>
                <DialogContent dividers><Stack spacing={1.5}>
                    {erroLote && <Alert severity="error">{erroLote}</Alert>}
                    {preparando ? <Typography role="status">Preparando recebíveis…</Typography> : <>
                        <Typography>{selecionado?.configuracaoNome} · {selecionado?.contaDestinoNome}</Typography>
                        <Typography>{itens.length} de {selecionado?.quantidade} recebíveis · até 200 por confirmação.</Typography>
                        <Typography sx={{ fontWeight: 600 }}>Valor a creditar: {itens.some(i => i.liquido == null) ? "Incompleto" : moeda.format(itens.reduce((s, i) => s + (i.liquido ?? 0), 0))}</Typography>
                        <Typography variant="body2">Todos os itens deste lote serão liquidados na mesma transação, usando valores e destinos históricos.</Typography>
                        <Box sx={{ maxHeight: 160, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 1 }}>
                            {itens.map(i => <Link key={i.id} href={`/vendas?vendaId=${i.vendaId}`} target="_blank" rel="noopener noreferrer">Venda #{i.vendaId} · recebível #{i.id}</Link>)}
                        </Box>
                    </>}
                </Stack></DialogContent>
                <DialogActions><Button onClick={() => setSelecionado(null)} disabled={processando}>Voltar</Button>
                    <Button type="submit" variant="contained" disabled={processando || preparando || !itens.length || itens.some(i => i.liquido == null)}>{processando ? "Confirmando…" : "Confirmar recebimento"}</Button></DialogActions>
            </Box>
        </Dialog>
    </Dialog>;
}
