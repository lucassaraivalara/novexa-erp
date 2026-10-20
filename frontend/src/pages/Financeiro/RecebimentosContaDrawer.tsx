import { useEffect, useRef, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Drawer,
    IconButton, Link, MenuItem, Stack, TextField, Typography } from "@mui/material";
import AppTable, { type Coluna } from "../../components/ui/AppTable";
import { listarRecebimentosContas } from "../../services/recebimentoContaService";
import { mensagemContaFinanceira } from "../../services/contaFinanceiraService";
import { liquidarRecebivel } from "../../services/recebivelService";
import { confirmarRecebimentoPix } from "../../services/vendaService";
import type { RecebimentoConta, SituacaoRecebimentoConta } from "../../types/recebimentoConta";
import { obterSessao } from "../../utils/auth/sessao";
import { podeExecutarAcaoGerencial } from "../../utils/auth/perfis";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formas = { PIX: "PIX", CARTAO_DEBITO: "Débito", CARTAO_CREDITO: "Crédito" };
const data = (valor: string | null, hora = false) => valor
    ? new Date(hora ? valor : `${valor}T12:00:00`).toLocaleString("pt-BR", hora ? undefined : { dateStyle: "short" })
    : "Não informada";

type Props = { contaId?: number; nome?: string; semDestino?: boolean; onFechar: () => void; onAlterado: () => void };

export default function RecebimentosContaDrawer({ contaId, nome, semDestino = false, onFechar, onAlterado }: Props) {
    const [items, setItems] = useState<RecebimentoConta[]>([]);
    const [status, setStatus] = useState<SituacaoRecebimentoConta>("A_LIQUIDAR");
    const [pagina, setPagina] = useState(0);
    const [total, setTotal] = useState(0);
    const [versao, setVersao] = useState(0);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [aviso, setAviso] = useState("");
    const [confirmacao, setConfirmacao] = useState<RecebimentoConta | null>(null);
    const [erroConfirmacao, setErroConfirmacao] = useState("");
    const [processando, setProcessando] = useState(false);
    const enviando = useRef(false);
    const podeConfirmar = podeExecutarAcaoGerencial(obterSessao()?.perfil);

    useEffect(() => {
        const controller = new AbortController();
        listarRecebimentosContas({ contaId, semDestino, status, page: pagina, size: 10, sort: "dataHora,desc" }, controller.signal)
            .then(resposta => {
                if (controller.signal.aborted) return;
                setItems(resposta.items); setTotal(resposta.totalItems); setErro("");
                if (pagina > 0 && !resposta.items.length) setPagina(Math.max(0, resposta.totalPages - 1));
            })
            .catch(e => { if (!controller.signal.aborted) {
                setItems([]); setTotal(0);
                setErro(mensagemContaFinanceira(e, "Não foi possível consultar os recebimentos."));
            } })
            .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        return () => controller.abort();
    }, [contaId, semDestino, status, pagina, versao]);

    function recarregar() { setCarregando(true); setVersao(v => v + 1); }
    async function confirmar() {
        if (!confirmacao || enviando.current || !podeConfirmar || !confirmacao.contaDestinoId
            || confirmacao.valorLiquidoPrevisto == null || confirmacao.status !== "A_LIQUIDAR") return;
        enviando.current = true; setProcessando(true); setErroConfirmacao("");
        try {
            if (confirmacao.formaPagamento === "PIX") await confirmarRecebimentoPix(confirmacao.id);
            else if (confirmacao.recebivelId) await liquidarRecebivel(confirmacao.recebivelId);
            else return;
            setConfirmacao(null); setAviso("Recebimento liquidado. O saldo disponível foi atualizado.");
            recarregar(); onAlterado();
        } catch (e) { setErroConfirmacao(mensagemContaFinanceira(e, "Não foi possível confirmar o recebimento.")); }
        finally { enviando.current = false; setProcessando(false); }
    }

    const colunas: Coluna<RecebimentoConta>[] = [
        { campo: "status", cabecalho: "Situação", largura: 140, render: (_, item) =>
            <Chip size="small" variant="outlined" color={item.status === "LIQUIDADO" ? "success" : "warning"}
                label={item.status === "LIQUIDADO" ? "LIQUIDADO" : "A LIQUIDAR"} /> },
        { campo: "configuracaoNome", cabecalho: "Pagamento e destino", largura: 230, render: (_, item) => <Box sx={{ overflowWrap: "anywhere" }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{formas[item.formaPagamento]} · {item.configuracaoNome || "Configuração não registrada"}</Typography>
            <Typography variant="caption" color="text.secondary">{item.contaDestinoNome || "Sem destino histórico — requer análise"}</Typography>
            <Box><Link href={`/vendas?vendaId=${item.vendaId}`} target="_blank" rel="noopener noreferrer"
                title="Abrir venda em nova aba">Venda #{item.vendaId}</Link></Box>
            <Typography variant="caption" color="text.secondary">{data(item.dataHora, true)}</Typography>
        </Box> },
        { campo: "dataPrevista", cabecalho: "Previsão / liquidação", largura: 180, render: (_, item) => <Box>
            <Typography variant="body2">{item.status === "LIQUIDADO" ? data(item.dataLiquidacao, true) : data(item.dataPrevista)}</Typography>
            <Typography variant="caption" color="text.secondary">{item.status === "LIQUIDADO"
                ? `Movimento #${item.movimentacaoFinanceiraId}` : item.formaPagamento === "PIX" ? "Aguarda confirmação do PIX" : "Aguarda liquidação do cartão"}</Typography>
        </Box> },
        { campo: "valorBruto", cabecalho: "Bruto", largura: 110, alinhar: "right", render: (_, item) => moeda.format(item.valorBruto) },
        { campo: "valorTaxas", cabecalho: "Taxas", largura: 110, alinhar: "right", render: (_, item) => item.valorTaxas == null ? "—" : moeda.format(item.valorTaxas) },
        { campo: "valorLiquidoPrevisto", cabecalho: "Líquido", largura: 120, alinhar: "right", render: (_, item) => <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {(item.status === "LIQUIDADO" ? item.valorLiquidado : item.valorLiquidoPrevisto) == null
                    ? "Não informado" : moeda.format((item.status === "LIQUIDADO" ? item.valorLiquidado : item.valorLiquidoPrevisto)!)}
            </Typography>
            <Typography variant="caption" color="text.secondary">{item.status === "LIQUIDADO" ? "Confirmado" : "Previsto"}</Typography>
        </Box> },
        { campo: "id", cabecalho: "Ação", largura: 160, render: (_, item) =>
            item.status === "A_LIQUIDAR" && !item.contaDestinoId
                ? <Typography variant="caption" color="text.secondary">Destino ausente no histórico</Typography>
                : item.status === "A_LIQUIDAR" && item.valorLiquidoPrevisto == null
                    ? <Typography variant="caption" color="text.secondary">Valor líquido ausente no histórico</Typography>
                : item.status === "A_LIQUIDAR" && podeConfirmar
                    ? <Button size="small" disabled={processando || carregando}
                        onClick={() => { setErroConfirmacao(""); setConfirmacao(item); }}>
                        {item.formaPagamento === "PIX" ? "Confirmar PIX" : "Liquidar cartão"}</Button> : null },
    ];
    return <Drawer anchor="right" open onClose={processando ? undefined : onFechar}
        slotProps={{ paper: { "aria-labelledby": "recebimentos-conta-titulo",
            sx: { width: { xs: "100%", lg: 1120 }, maxWidth: "100vw" } } }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Typography id="recebimentos-conta-titulo" component="h2" variant="h6" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                PIX e cartões · {nome || (semDestino ? "Sem destino histórico" : "Todas as contas")}
            </Typography>
            <IconButton aria-label="Fechar recebimentos" onClick={onFechar} disabled={processando}><CloseRoundedIcon /></IconButton>
        </Stack>
        <Box sx={{ p: { xs: 1.5, sm: 2.5 }, overflow: "auto", overscrollBehavior: "contain", flex: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                A LIQUIDAR é uma previsão. LIQUIDADO confirma a entrada na conta de destino.
                Fechar o Caixa não liquida PIX ou cartão. O saldo disponível também considera saídas e transferências.
            </Typography>
            {semDestino && <Alert severity="warning" sx={{ mb: 2 }}>Estes pagamentos antigos não possuem destino registrado.
                Alterar a forma de pagamento atual não corrige o histórico. Não faça uma nova entrada para compensar sem conferir a origem.</Alert>}
            {aviso && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAviso("")}>{aviso}</Alert>}
            {erro && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={recarregar}>Tentar novamente</Button>}>{erro}</Alert>}
            <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: "center" }}>
                <TextField select label="Situação do recebimento" size="small" value={status} sx={{ minWidth: 210 }}
                    onChange={e => { setCarregando(true); setStatus(e.target.value as SituacaoRecebimentoConta); setPagina(0); }}>
                    <MenuItem value="A_LIQUIDAR">A LIQUIDAR</MenuItem>
                    <MenuItem value="LIQUIDADO">LIQUIDADO</MenuItem>
                </TextField>
                <Button onClick={recarregar} disabled={carregando}>Atualizar</Button>
            </Stack>
            <AppTable colunas={colunas} linhas={items} carregando={carregando} obterChaveLinha={item => item.id} minWidth={1050}
                vazio={{ titulo: erro ? "Consulta indisponível" : "Nenhum recebimento nesta situação",
                    descricao: erro ? "Tente consultar novamente." : "Selecione outra situação para consultar o histórico." }}
                paginacao={{ pagina, linhasPorPagina: 10, total, onPageChange: p => { setCarregando(true); setPagina(p); },
                    onRowsPerPageChange: () => {}, opcoesLinhasPorPagina: [10] }} />
        </Box>
        <Dialog open={confirmacao !== null} onClose={processando ? undefined : () => setConfirmacao(null)}
            aria-labelledby="confirmar-recebimento-conta" fullWidth maxWidth="xs">
            <Box component="form" onSubmit={e => { e.preventDefault(); void confirmar(); }}>
                <DialogTitle id="confirmar-recebimento-conta">{confirmacao?.formaPagamento === "PIX" ? "Confirmar recebimento PIX?" : "Liquidar cartão?"}</DialogTitle>
                <DialogContent><Stack spacing={1}>
                    <Typography>Venda #{confirmacao?.vendaId} · {confirmacao?.configuracaoNome}</Typography>
                    <Typography>Conta de destino: <strong>{confirmacao?.contaDestinoNome}</strong></Typography>
                    <Typography>Valor a creditar: <strong>{confirmacao?.valorLiquidoPrevisto != null ? moeda.format(confirmacao.valorLiquidoPrevisto) : "Não informado"}</strong></Typography>
                    <Alert severity="warning">Confirme somente após conferir o recebimento no banco ou gateway. Esta ação credita o saldo disponível.</Alert>
                    {erroConfirmacao && <Alert severity="error">{erroConfirmacao}</Alert>}
                </Stack></DialogContent>
                <DialogActions><Button autoFocus onClick={() => setConfirmacao(null)} disabled={processando}>Voltar</Button>
                    <Button type="submit" variant="contained" disabled={processando} aria-busy={processando}>
                        {processando ? "Confirmando…" : "Confirmar recebimento"}</Button></DialogActions>
            </Box>
        </Dialog>
    </Drawer>;
}
