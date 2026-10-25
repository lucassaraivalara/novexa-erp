import CampoTexto from "../../components/ui/CampoTexto";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { Alert, alpha, Box, Button, ButtonBase, Dialog, DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Stack, Typography } from "@mui/material";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import PixIcon from "@mui/icons-material/Pix";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ShoppingCartCheckoutRoundedIcon from "@mui/icons-material/ShoppingCartCheckoutRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import type { ConfiguracaoFormaPagamento } from "../../types/configuracaoFormaPagamento";
import { decimal, moeda, pagamentosRascunho, parcelamentoValido, subtotalItem, type PagamentoPDV, type RascunhoPDV, type totais } from "./pdv";
import ValorMonetarioPDV from "./ValorMonetarioPDV";

type Props = {
    open: boolean; rascunho: RascunhoPDV; t: ReturnType<typeof totais>; configuracoes: ConfiguracaoFormaPagamento[];
    carregando: boolean; erroConfig: string; erro: string; estoqueConfirmado: boolean; bloqueado: boolean; salvando: boolean; confirmarDesabilitado: boolean;
    primeiraFormaRef: RefObject<HTMLInputElement | null>; recebidoRef: RefObject<HTMLInputElement | null>;
    confirmarRef: RefObject<HTMLButtonElement | null>; erroRef: RefObject<HTMLDivElement | null>;
    onAlterar: (patch: Partial<RascunhoPDV>) => void; onCliente: () => void; onConfirmar: () => void; onVoltar: () => void;
};
const meios = { DINHEIRO: { forma: "DINHEIRO", Icone: PaymentsOutlinedIcon }, PIX: { forma: "PIX", Icone: PixIcon },
    DEBITO: { forma: "CARTAO_DEBITO", Icone: PaymentOutlinedIcon }, CREDITO: { forma: "CARTAO_CREDITO", Icone: CreditCardOutlinedIcon } } as const;

export default function PagamentoVendaDialog({ open, rascunho, t, configuracoes, carregando, erroConfig, erro, estoqueConfirmado, bloqueado, salvando,
    confirmarDesabilitado, primeiraFormaRef, recebidoRef, confirmarRef, erroRef, onAlterar, onCliente, onConfirmar, onVoltar }: Props) {
    const campos = useRef<Record<string, HTMLInputElement | null>>({});
    const focoPendente = useRef<string | null>(null);
    const aberturaInicializada = useRef(false);
    const pagamentos = pagamentosRascunho(rascunho);
    useLayoutEffect(() => {
        if (!open) { aberturaInicializada.current = false; focoPendente.current = null; return; }
        if (aberturaInicializada.current || carregando || erroConfig || bloqueado) return;
        aberturaInicializada.current = true;
        const primeira = configuracoes[0];
        if (!primeira || t.total <= 0 || pagamentos.some(p => p.configuracaoFormaPagamentoId !== null || p.formaPagamento === "A_PRAZO")) return;
        primeiraFormaRef.current?.blur();
        focoPendente.current = String(primeira.id);
        const valor = (t.total / 100).toFixed(2);
        onAlterar({ pagamentos: [{ configuracaoFormaPagamentoId: primeira.id, nomeExibicao: primeira.nomeExibicao,
            formaPagamento: meios[primeira.tipo as keyof typeof meios].forma, valor, recebido: primeira.tipo === "DINHEIRO" ? valor : "" }] });
    }, [open, carregando, erroConfig, bloqueado, configuracoes, pagamentos, t.total, onAlterar, primeiraFormaRef]);
    useLayoutEffect(() => {
        const chave = focoPendente.current;
        if (chave === null) return;
        if (chave === "prazo" ? !rascunho.parcelasPrazo?.length : !rascunho.pagamentos?.some(p => String(p.configuracaoFormaPagamentoId) === chave)) return;
        focoPendente.current = null;
        campos.current[chave]?.focus(); campos.current[chave]?.select();
    }, [rascunho.pagamentos, rascunho.parcelasPrazo]);
    function focoValor(chave: string, aposPreencher = false) {
        if (aposPreencher) { focoPendente.current = chave; return; }
        requestAnimationFrame(() => { campos.current[chave]?.focus(); campos.current[chave]?.select(); });
    }
    function alterarValor(config: ConfiguracaoFormaPagamento, valor: string, removerOrigem?: number) {
        const base = removerOrigem === undefined ? pagamentos : pagamentos.filter(p => p.configuracaoFormaPagamentoId !== removerOrigem);
        const atual = base.find(p => p.configuracaoFormaPagamentoId === config.id);
        const outros = base.filter(p => p.formaPagamento === "A_PRAZO" || (p.configuracaoFormaPagamentoId !== null && p.configuracaoFormaPagamentoId !== config.id));
        if (valor === "" || decimal(valor, 2) === 0) { onAlterar({ pagamentos: outros }); return; }
        if (!atual && outros.length >= 20) return;
        const dinheiro = config.tipo === "DINHEIRO";
        const pagamento: PagamentoPDV = { configuracaoFormaPagamentoId: config.id, nomeExibicao: config.nomeExibicao,
            formaPagamento: meios[config.tipo as keyof typeof meios].forma, valor,
            ...(config.tipo === "CREDITO" ? { parcelasConsumidor: atual?.parcelasConsumidor ?? 1 } : {}),
            recebido: dinheiro ? valor : "" };
        onAlterar({ pagamentos: atual ? base.map(p => p === atual ? pagamento : p) : [...outros, pagamento] });
    }
    function selecionar(config: ConfiguracaoFormaPagamento) {
        const preencher = !pagamentos.some(p => p.configuracaoFormaPagamentoId === config.id) && t.restante > 0 && pagamentos.length < 20;
        focoValor(String(config.id), preencher);
        if (preencher) alterarValor(config, (t.restante / 100).toFixed(2));
    }
    function selecionarPrazo(valor = (Math.max(0, t.restante) / 100).toFixed(2)) {
        const outros = pagamentos.filter(p => p.configuracaoFormaPagamentoId !== null && p.formaPagamento !== "A_PRAZO");
        if (valor === "" || decimal(valor, 2) === 0) { onAlterar({ pagamentos: outros }); return; }
        if (!t.usaPrazo && outros.length >= 20) return;
        onAlterar({ pagamentos: [...outros, { configuracaoFormaPagamentoId: null, nomeExibicao: "A prazo", formaPagamento: "A_PRAZO", valor, recebido: "" }],
            parcelasPrazo: [{ valor, vencimento: t.parcelasPrazo[0]?.vencimento ?? "" }] });
    }
    function avancar(chave: string, direcao = 1, concluir = true, transferirSelecionado = false) {
        if (concluir && !confirmarDesabilitado) { confirmarRef.current?.focus(); return; }
        if (concluir && t.restante <= 0) return;
        const indice = configuracoes.findIndex(c => String(c.id) === chave);
        const proxima = configuracoes[indice + direcao];
        const origem = t.parcelas.find(p => String(p.configuracaoFormaPagamentoId) === chave);
        const valorOrigem = origem ? decimal(origem.formaPagamento === "DINHEIRO" ? origem.recebido || origem.valor : origem.valor, 2) : null;
        if (transferirSelecionado && proxima && origem?.configuracaoFormaPagamentoId != null && valorOrigem !== null && valorOrigem > 0
            && !pagamentos.some(p => p.configuracaoFormaPagamentoId === proxima.id)) {
            const valor = proxima.tipo === "DINHEIRO" ? valorOrigem : Math.min(valorOrigem, Math.max(0, t.restante + (origem.valorCentavos ?? 0)));
            if (valor > 0) {
                focoValor(String(proxima.id), true);
                alterarValor(proxima, (valor / 100).toFixed(2), origem.configuracaoFormaPagamentoId);
                return;
            }
        }
        if (proxima) { if (direcao > 0) selecionar(proxima); else focoValor(String(proxima.id)); }
        else if (direcao > 0) {
            const preencher = !t.usaPrazo && t.restante > 0;
            focoValor("prazo", preencher); if (preencher) selecionarPrazo();
        }
    }
    return <Dialog open={open} onClose={onVoltar} fullWidth maxWidth="md" aria-labelledby="pdv-pagamento-titulo" aria-describedby="pdv-pagamento-descricao"
        onKeyDown={e => { if (e.key !== "Escape") e.stopPropagation(); if (e.key === "F2") { e.preventDefault(); if (!e.repeat && !e.nativeEvent.isComposing && !confirmarDesabilitado) onConfirmar(); } }}
        slotProps={{ paper: { sx: { m: { xs: 1, md: 3 }, width: "calc(100% - 16px)", maxHeight: { xs: "calc(100dvh - 16px)", md: "calc(100dvh - 48px)" }, borderRadius: 2 } } }}>
        <DialogTitle id="pdv-pagamento-titulo" sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: "divider" }}>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}><Box><Typography component="span" variant="h5" sx={{ fontWeight: 700 }}>Pagamento da venda</Typography><Typography variant="body2" color="text.secondary">PDV Novexa · Sessão #{rascunho.sessaoCaixaId}</Typography></Box><IconButton aria-label="Fechar pagamento" onClick={onVoltar} disabled={salvando}><CloseRoundedIcon /></IconButton></Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 2.5, minHeight: 0, display: { xs: "flex", md: "grid" }, flexDirection: "column", gridTemplateColumns: { md: "minmax(0, .85fr) minmax(0, 1.2fr)" }, gap: 3, overflow: { xs: "auto", md: "hidden" }, overscrollBehavior: "contain" }}>
            <Stack component="section" aria-label="Resumo do pagamento" sx={{ minWidth: 0, minHeight: { xs: "auto", md: 0 }, gap: 1.5 }}>
                <Box sx={{ p: 2, flexShrink: 0, bgcolor: theme => alpha(theme.palette.primary.main, .06), borderRadius: 1.5 }}>
                    <Typography variant="subtitle2">Total da venda</Typography><Typography aria-label="Total a pagar" sx={{ fontSize: { xs: 32, md: 40 }, fontWeight: 800, color: "primary.main", fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>{moeda(Math.max(0, t.total))}</Typography>
                    <Stack direction="row" aria-live="polite" sx={{ gap: 2, pt: 1.25, mt: 1, borderTop: 1, borderColor: "divider", flexWrap: "wrap" }}><Box><Typography variant="caption" color="text.secondary">Valor aplicado</Typography><Typography aria-label="Valor aplicado" sx={{ fontWeight: 700 }}>{moeda(t.totalInformado)}</Typography></Box><Box><Typography variant="caption" color="text.secondary">Falta a pagar</Typography><Typography aria-label="Falta a pagar" sx={{ fontWeight: 700, color: t.restante < 0 ? "error.main" : "primary.main" }}>{moeda(Math.max(0, t.restante))}</Typography></Box></Stack>
                </Box>
                <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}><Typography variant="subtitle2">Itens da venda</Typography><Typography variant="body2" color="text.secondary">{rascunho.itens.length} {rascunho.itens.length === 1 ? "item" : "itens"}</Typography></Stack>
                <Box component="ul" aria-label="Produtos da venda" sx={{ m: 0, p: 0, listStyle: "none", overflowY: "auto", minHeight: 0, flex: 1, maxHeight: { xs: 160, md: "none" }, "& li + li": { borderTop: 1, borderColor: "divider" } }}>
                    {rascunho.itens.map(item => <Box component="li" key={item.produto.id} sx={{ py: 1 }}><Typography variant="body2" sx={{ fontWeight: 500, overflowWrap: "anywhere" }}>{item.produto.nome}</Typography><Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, mt: .25 }}><Typography variant="caption" color="text.secondary">{item.quantidade} {item.produto.unidadeMedida}</Typography><Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{moeda(subtotalItem(item) ?? 0)}</Typography></Stack></Box>)}
                </Box>
            </Stack>
            <Stack component="section" aria-label="Pagamentos da venda" sx={{ minWidth: 0, minHeight: { xs: "auto", md: 0 }, gap: 1.5 }}>
                <Box><Typography component="h2" variant="h6" sx={{ fontSize: 18, fontWeight: 700 }}>Meios de pagamento</Typography><Typography id="pdv-pagamento-descricao" variant="body2" color="text.secondary">Escolha um meio para preencher o restante e ajuste os valores.</Typography></Box>
                <Box sx={{ minHeight: 0, overflowY: "auto", flex: 1, pr: .5 }}>
                    {erro && <Alert severity="error" tabIndex={-1} ref={erroRef} sx={{ mb: 1.5 }}>{erro}</Alert>}
                    {estoqueConfirmado && <Alert severity="warning" sx={{ mb: 1.5 }}>Estoque insuficiente autorizado. Confirme o pagamento para concluir a venda.</Alert>}
                    {carregando ? <Typography role="status">Carregando formas de pagamento…</Typography> : erroConfig ? <Alert severity="error" ref={erroRef} tabIndex={-1}>{erroConfig}</Alert> : <>
                        {configuracoes.map((config, i) => {
                            const p = t.parcelas.find(p => p.configuracaoFormaPagamentoId === config.id);
                            const { Icone } = meios[config.tipo as keyof typeof meios];
                            return <Box role="group" aria-label={config.nomeExibicao} key={config.id} sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 132px", gap: 1, alignItems: "center", py: 1, px: 1, borderBottom: 1, borderColor: "divider", bgcolor: p ? theme => alpha(theme.palette.primary.main, .06) : undefined, borderRadius: 1 }}>
                                <ButtonBase disabled={bloqueado || (!p && pagamentos.length >= 20)} onClick={() => selecionar(config)} aria-label={`Usar ${config.nomeExibicao}`} sx={{ gap: 1, justifyContent: "flex-start", minWidth: 0, minHeight: 40, textAlign: "left", borderRadius: 1, "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } }}><Icone aria-hidden="true" sx={{ fontSize: 23, color: "primary.main", flexShrink: 0 }} /><Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{config.nomeExibicao}</Typography></ButtonBase>
                                <ValorMonetarioPDV size="small" autoFocus={i === 0} value={config.tipo === "DINHEIRO" ? p?.recebido || p?.valor || "" : p?.valor ?? ""} placeholder="0,00" disabled={bloqueado} inputRef={el => { campos.current[String(config.id)] = el; if (i === 0) primeiraFormaRef.current = el; if (config.id === configuracoes.find(c => c.tipo === "DINHEIRO")?.id) recebidoRef.current = el; }}
                                    slotProps={{ htmlInput: { "aria-label": `Valor de ${config.nomeExibicao} (R$)`, inputMode: "decimal", style: { textAlign: "right", fontWeight: 600 } }, input: { startAdornment: <InputAdornment position="start">R$</InputAdornment> } }}
                                    onClick={() => { if (!p) { campos.current[String(config.id)]?.blur(); selecionar(config); } }} onChange={valor => alterarValor(config, valor)}
                                    onKeyDown={e => { if (["Enter", "ArrowDown", "ArrowUp"].includes(e.key) && !e.nativeEvent.isComposing) {
                                        e.preventDefault(); e.stopPropagation();
                                        const campo = e.target as HTMLInputElement;
                                        const selecionado = campo.value.length > 0 && campo.selectionStart === 0 && campo.selectionEnd === campo.value.length;
                                        if (!e.repeat) avancar(String(config.id), e.key === "ArrowUp" ? -1 : 1, e.key === "Enter", e.key !== "Enter" && selecionado);
                                    } }} />
                                {p && p.troco > 0 && <Typography aria-label={`Troco em ${config.nomeExibicao}`} variant="body2" sx={{ gridColumn: "1 / -1", textAlign: "right", color: "primary.main", fontWeight: 700 }} aria-live="polite">Troco: {moeda(p.troco)}</Typography>}
                                {p && config.tipo === "CREDITO" && ((config.maximoParcelasConsumidor ?? 1) > 1 || (p.parcelasConsumidor ?? 1) > 1) &&
                                    <CampoTexto select size="small" sx={{ gridColumn: "1 / -1" }} label={`Parcelas do consumidor — ${config.nomeExibicao}`}
                                        value={p.parcelasConsumidor ?? 1} disabled={bloqueado} error={!parcelamentoValido(p, config)}
                                        helperText={!parcelamentoValido(p, config) ? "O limite desta configuração mudou. Revise as parcelas." : undefined}
                                        onChange={e => onAlterar({ pagamentos: pagamentos.map(item => item.configuracaoFormaPagamentoId === config.id ? { ...item, parcelasConsumidor: Number(e.target.value) } : item) })}>
                                        {Array.from({ length: config.maximoParcelasConsumidor ?? 1 }, (_, indice) => <MenuItem key={indice + 1} value={indice + 1}>{indice === 0 ? "1x (à vista)" : `${indice + 1}x`}</MenuItem>)}
                                        {(p.parcelasConsumidor ?? 1) > (config.maximoParcelasConsumidor ?? 1) && <MenuItem value={p.parcelasConsumidor}>{p.parcelasConsumidor}x (indisponível)</MenuItem>}
                                    </CampoTexto>}
                            </Box>;
                        })}
                        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 132px", alignItems: "center", gap: 1, p: 1, bgcolor: t.usaPrazo ? "action.selected" : undefined }}>
                            <Button startIcon={<EventNoteOutlinedIcon />} disabled={bloqueado || (!t.usaPrazo && pagamentos.length >= 20)} onClick={() => { if (!t.usaPrazo && t.restante <= 0) { focoValor("prazo"); return; } if (!t.usaPrazo) selecionarPrazo(); if (!rascunho.cliente) onCliente(); else focoValor("prazo"); }} sx={{ justifyContent: "flex-start" }}>A prazo</Button>
                            <ValorMonetarioPDV size="small" value={t.usaPrazo ? (t.totalPrazo / 100).toFixed(2) : ""} placeholder="0,00" disabled={bloqueado || t.parcelasPrazo.length > 1}
                                inputRef={el => { campos.current.prazo = el; }} slotProps={{ htmlInput: { "aria-label": "Valor a prazo (R$)", inputMode: "decimal", style: { textAlign: "right" } } }} onChange={selecionarPrazo} />
                        </Box>
                        {t.usaPrazo && <Stack spacing={1} sx={{ p: 1 }}>
                            {!rascunho.cliente && <Alert severity="warning">Selecione um cliente para vender a prazo.</Alert>}
                            <Button size="small" aria-label="Selecionar cliente do pagamento" startIcon={<PersonOutlineRoundedIcon />} disabled={bloqueado} onClick={onCliente} sx={{ alignSelf: "flex-start" }}>{rascunho.cliente ? `Cliente: ${rascunho.cliente.nome}` : "Selecionar cliente"}</Button>
                            {t.parcelasPrazo.map((parcela, indice) => <Stack key={indice} role="group" aria-label={`Parcela a prazo ${indice + 1}`} direction="row" sx={{ gap: 1, alignItems: "start" }}>
                                <CampoTexto size="small" type="date" fullWidth label={`Vencimento ${indice + 1}`} value={parcela.vencimento} disabled={bloqueado} slotProps={{ inputLabel: { shrink: true } }}
                                    error={!/^\d{4}-\d{2}-\d{2}$/.test(parcela.vencimento) || Number.isNaN(Date.parse(parcela.vencimento))} helperText={!parcela.vencimento ? "Informe o vencimento." : undefined}
                                    onChange={e => onAlterar({ parcelasPrazo: t.parcelasPrazo.map((p, j) => ({ valor: p.valor, vencimento: j === indice ? e.target.value : p.vencimento })) })} />
                                <ValorMonetarioPDV size="small" sx={{ width: 115, flexShrink: 0 }} value={parcela.valor} disabled={bloqueado} slotProps={{ htmlInput: { "aria-label": `Valor da parcela ${indice + 1} (R$)`, inputMode: "decimal" } }}
                                    onChange={valor => onAlterar({ parcelasPrazo: t.parcelasPrazo.map((p, j) => ({ valor: j === indice ? valor : p.valor, vencimento: p.vencimento })) })} />
                                {t.parcelasPrazo.length > 1 && <IconButton aria-label={`Remover parcela a prazo ${indice + 1}`} disabled={bloqueado} onClick={() => onAlterar({ parcelasPrazo: rascunho.parcelasPrazo?.filter((_, j) => j !== indice) })}><DeleteOutlineRoundedIcon /></IconButton>}
                            </Stack>)}
                            <Button size="small" startIcon={<AddRoundedIcon />} disabled={bloqueado || t.parcelasPrazo.length >= 120} onClick={() => onAlterar({ parcelasPrazo: [...t.parcelasPrazo.map(p => ({ valor: p.valor, vencimento: p.vencimento })), { valor: (Math.max(0, t.restante) / 100).toFixed(2), vencimento: "" }] })} sx={{ alignSelf: "start" }}>Adicionar parcela</Button>
                            <Typography variant="body2" aria-label="A receber">A receber: {moeda(t.totalPrazo)}</Typography>
                        </Stack>}
                        {pagamentos.some(p => p.formaPagamento !== "A_PRAZO" && p.configuracaoFormaPagamentoId !== null && !configuracoes.some(c => c.id === p.configuracaoFormaPagamentoId)) && <Alert severity="warning" action={<Button disabled={bloqueado} onClick={() => onAlterar({ pagamentos: pagamentos.filter(p => p.formaPagamento === "A_PRAZO" || configuracoes.some(c => c.id === p.configuracaoFormaPagamentoId)) })}>Remover</Button>}>Há uma forma indisponível no rascunho. Revise os pagamentos.</Alert>}
                    </>}
                </Box>
            </Stack>
        </DialogContent>
        <Stack sx={{ flexShrink: 0, p: 2, borderTop: 1, borderColor: "divider", gap: 1 }}>
            {!carregando && !erroConfig && t.restante !== 0 && <Typography variant="body2" color={t.restante < 0 ? "error.main" : "text.secondary"} role="status">{t.restante > 0 ? "Falta distribuir" : "Valor excedente"}: {moeda(Math.abs(t.restante))}</Typography>}
            <Stack direction={{ xs: "column-reverse", sm: "row" }} sx={{ gap: 1.5 }}><Button fullWidth variant="outlined" disabled={salvando} onClick={onVoltar} startIcon={<ArrowBackRoundedIcon />}>Voltar para a venda</Button><Button fullWidth variant="contained" ref={confirmarRef} aria-label="Concluir pagamento · F2" aria-keyshortcuts="F2" disabled={confirmarDesabilitado} onClick={onConfirmar} startIcon={<ShoppingCartCheckoutRoundedIcon />} sx={{ minHeight: 48, fontWeight: 700 }}>{salvando ? "Finalizando…" : "F2 — Concluir pagamento"}</Button></Stack>
        </Stack>
    </Dialog>;
}
