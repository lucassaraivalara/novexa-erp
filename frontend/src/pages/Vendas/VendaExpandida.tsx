import { useEffect, useState } from "react";
import { Alert, Box, Button, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import PixIcon from "@mui/icons-material/Pix";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import StatusChip from "../../components/ui/StatusChip";
import { buscarVenda, listarPagamentosVenda, mensagemVenda, type PagamentoVenda, type VendaDetalhe, type VendaResumo } from "../../services/vendaService";
import { dataHoraVenda, moedaVenda, rotulosPagamento, rotulosStatus } from "./centralVendasUtils";

export type ConsultaVenda = { detalhe: VendaDetalhe; pagamentos: PagamentoVenda[] };
const quantidade = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
const iconesPagamento = { DINHEIRO: PaymentsOutlinedIcon, PIX: PixIcon, CARTAO_CREDITO: CreditCardOutlinedIcon, CARTAO_DEBITO: PaymentOutlinedIcon };

type Props = {
    venda: VendaResumo;
    cache: Map<number, ConsultaVenda>;
    onCarregado: () => void;
};

/** Consulta comercial: usa os valores gravados na venda, sem consultar o cadastro atual. */
export default function VendaExpandida({ venda, cache, onCarregado }: Props) {
    const armazenada = cache.get(venda.id);
    const [dados, setDados] = useState<ConsultaVenda | undefined>(armazenada?.detalhe.status === venda.status ? armazenada : undefined);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);

    useEffect(() => {
        if (dados) return;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const [detalhe, pagamentos] = await Promise.all([
                    buscarVenda(venda.id, controller.signal), listarPagamentosVenda(venda.id, controller.signal),
                ]);
                if (controller.signal.aborted) return;
                const consulta = { detalhe, pagamentos };
                // Cache limitado à vida da página; cancelamento/atualização invalidam a venda afetada.
                if (cache.size >= 100) cache.delete(cache.keys().next().value!);
                cache.set(venda.id, consulta);
                setDados(consulta);
                onCarregado();
            } catch (e) {
                if (!controller.signal.aborted) setErro(mensagemVenda(e, "Não foi possível consultar esta venda."));
            }
        }, 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [venda.id, dados, cache, tentativa, onCarregado]);

    const id = `venda-expandida-${venda.id}`;
    if (erro) return <Box id={id} role="region" aria-label={`Consulta rápida da venda #${venda.id}`} sx={{ p: 2 }}>
        <Alert severity="error" action={<Button color="inherit" onClick={() => { setErro(""); setTentativa(t => t + 1); }}>Tentar novamente</Button>}>{erro}</Alert>
    </Box>;
    if (!dados) return <Box id={id} role="region" aria-label={`Consulta rápida da venda #${venda.id}`} aria-busy="true" sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" role="status" sx={{ mb: 1 }}>Carregando itens e pagamentos…</Typography><LinearProgress />
    </Box>;

    const { detalhe, pagamentos } = dados;
    const pagamentosVisiveis = pagamentos.filter(p => Object.hasOwn(rotulosPagamento, p.formaPagamento)
        && (p.status === "REGISTRADO" || detalhe.status === "CANCELADA"));
    // Pagamento.valor já é a parcela aplicada à venda; valorRecebido e troco não são faturamento.
    const prazo = detalhe.valorPrazo ?? detalhe.contasReceber?.reduce((soma, conta) => soma + conta.valorOriginal, 0) ?? 0;
    const totalDistribuido = (pagamentosVisiveis.reduce((soma, p) => soma + Math.round(p.valor * 100), 0) + Math.round(prazo * 100)) / 100;
    const cliente = venda.nomeCliente || detalhe.contasReceber?.[0]?.cliente?.nome || (detalhe.clienteId ? `Cliente #${detalhe.clienteId}` : "Consumidor final");

    return <Box id={id} role="region" aria-label={`Consulta rápida da venda #${venda.id}`}
        sx={{ p: { xs: 1.5, md: 2.5 }, bgcolor: "background.default", minWidth: 0 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1.65fr) minmax(260px, 1fr)" }, gap: { xs: 2.5, lg: 3 } }}>
            <Box component="section" aria-label="Itens da venda" sx={{ minWidth: 0 }}>
                <Stack direction="row" sx={{ gap: 1, alignItems: "baseline", mb: 1.25 }}>
                    <Typography component="h2" variant="subtitle2">Itens da venda</Typography>
                    <Typography variant="caption" color="text.secondary">{detalhe.itens.length} {detalhe.itens.length === 1 ? "linha" : "linhas"}</Typography>
                </Stack>
                <TableContainer sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 1.5 }}>
                    <Table size="small" aria-label={`Itens da venda #${venda.id}`} sx={{ minWidth: { xs: 460, sm: 0 }, "& th, & td": { px: 1.25, py: 1, borderColor: "divider" }, "& th": { bgcolor: "action.hover", color: "text.secondary", fontSize: 12, fontWeight: 500 }, "& td": { fontSize: 13, fontVariantNumeric: "tabular-nums" }, "& tr:last-child td": { borderBottom: 0 } }}>
                        <TableHead><TableRow><TableCell>Produto</TableCell><TableCell align="right">Quantidade</TableCell><TableCell align="right">Unitário</TableCell><TableCell align="right">Subtotal</TableCell></TableRow></TableHead>
                        <TableBody>{detalhe.itens.map(item => <TableRow key={item.id}>
                            <TableCell sx={{ overflowWrap: "anywhere" }}><Typography variant="body2" sx={{ fontWeight: 600 }}>{item.nomeProduto}</Typography><Typography variant="caption" color="text.secondary">Referência #{item.produtoId}</Typography></TableCell>
                            <TableCell align="right">{quantidade.format(item.quantidade)}</TableCell>
                            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{moedaVenda(item.precoUnitario)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{moedaVenda(item.subtotal)}</TableCell>
                        </TableRow>)}{!detalhe.itens.length && <TableRow><TableCell colSpan={4}>Nenhum item registrado nesta venda.</TableCell></TableRow>}</TableBody>
                    </Table>
                </TableContainer>
                {!!detalhe.desconto && <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">Desconto da venda: {moedaVenda(detalhe.desconto)}</Typography>}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>Preços e quantidades registrados na venda.</Typography>
            </Box>
            <Stack spacing={1.5} sx={{ minWidth: 0, alignSelf: "start", p: 1.5, bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 1.5 }}>
                <Box component="section" aria-label="Pagamentos da venda">
                    <Typography component="h2" variant="subtitle2" sx={{ mb: 0.5 }}>Pagamentos ({pagamentosVisiveis.length})</Typography>
                    <Stack spacing={1}>
                        <Box sx={{ "& > div": { display: "grid", gridTemplateColumns: "28px minmax(0, 1fr) auto", alignItems: "center", gap: 1, py: 1 }, "& > div + div": { borderTop: 1, borderColor: "divider" }, "& svg": { fontSize: 19, color: "primary.main" }, "& .valor-pagamento": { whiteSpace: "nowrap", fontWeight: 600, fontVariantNumeric: "tabular-nums" } }}>
                        {pagamentosVisiveis.map(p => {
                            const Icone = iconesPagamento[p.formaPagamento];
                            return <Box key={p.id}>
                                <Icone aria-hidden="true" />
                                <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>{p.configuracaoNomeExibicao || rotulosPagamento[p.formaPagamento]}{p.status === "CANCELADO" ? " (cancelado)" : ""}</Typography>
                                <Typography variant="body2" className="valor-pagamento">{moedaVenda(p.valor)}</Typography>
                            </Box>;
                        })}
                        {prazo > 0 && <Box><EventNoteOutlinedIcon aria-hidden="true" /><Typography variant="body2">A prazo</Typography><Typography variant="body2" className="valor-pagamento">{moedaVenda(prazo)}</Typography></Box>}
                        </Box>
                        {!pagamentosVisiveis.length && !prazo && <Typography variant="body2" color="text.secondary">Nenhum pagamento vinculado.</Typography>}
                        <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, borderTop: 1, borderColor: "divider", pt: 1.25 }}>
                            <Typography variant="caption" color="text.secondary">Total distribuído</Typography><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{moedaVenda(totalDistribuido)}</Typography>
                        </Stack>
                        {!!detalhe.troco && <Typography variant="caption" color="text.secondary">Troco: {moedaVenda(detalhe.troco)} · não integra o total distribuído.</Typography>}
                        <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", gap: 1.5, px: 1.25, py: 1, borderRadius: 1,
                            color: "primary.main", bgcolor: theme => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.14 : 0.08) }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>Total da venda</Typography>
                            <Typography sx={{ fontSize: 18, fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{moedaVenda(detalhe.total)}</Typography>
                        </Stack>
                    </Stack>
                </Box>
                <Box component="section" aria-label="Informações da venda" sx={{ pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                    <Typography component="h2" variant="subtitle2" sx={{ mb: 1 }}>Informações da venda</Typography>
                    <Box component="dl" sx={{ m: 0, display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: "12px 16px", "& dt": { color: "text.secondary", fontSize: 12, mb: 0.25 }, "& dd": { m: 0, overflowWrap: "anywhere" }, fontSize: 13 }}>
                        <Box><Box component="dt">Cliente</Box><Box component="dd">{cliente}</Box></Box>
                        <Box><Box component="dt">Data / hora</Box><Box component="dd">{dataHoraVenda(detalhe.dataHora)}</Box></Box>
                        <Box><Box component="dt">Caixa / sessão</Box><Box component="dd">{detalhe.sessaoCaixaId ? `Sessão #${detalhe.sessaoCaixaId}` : "Sem sessão"}</Box></Box>
                        <Box><Box component="dt">Status</Box><Box component="dd"><StatusChip status={detalhe.status} label={rotulosStatus[detalhe.status]} /></Box></Box>
                        {!!detalhe.observacoes && <Box sx={{ gridColumn: "1 / -1" }}><Box component="dt">Observações</Box><Box component="dd" sx={{ whiteSpace: "pre-wrap" }}>{detalhe.observacoes}</Box></Box>}
                    </Box>
                </Box>
            </Stack>
        </Box>
    </Box>;
}
