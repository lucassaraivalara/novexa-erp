import { useRef, useState, type FormEvent } from "react";
import axios from "axios";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
    MenuItem, Stack, Typography } from "@mui/material";
import CampoTexto from "../../components/ui/CampoTexto";
import { CampoMonetario } from "../../components/ui/CampoDecimal";
import { hojeBrasilia, formatarData } from "../../utils/dataHora";
import { buscarPagamentoPorChave, mensagemContaPagar, pagarContaMultiorigem } from "../../services/contaPagarService";
import type { ContaPagar, PagamentoMultiorigemInput } from "../../types/contaPagar";
import type { ContaFinanceira } from "../../types/contaFinanceira";
import { rotulosTipoContaFinanceira } from "../../types/contaFinanceira";
import { calcularPagamento, centavosPagamento, decimalPagamento } from "./contaPagarCalculos";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type Origem = { linha: number; contaFinanceiraId: number | ""; valor: string };
type Props = { conta: ContaPagar; contasFinanceiras: ContaFinanceira[]; onFechar: () => void; onConcluido: (mensagem: string) => void };

export default function PagamentoContaPagarDialog({ conta, contasFinanceiras, onFechar, onConcluido }: Props) {
    const [tipo, setTipo] = useState("integral");
    const [principalParcial, setPrincipalParcial] = useState("");
    const [dataPagamento, setDataPagamento] = useState(hojeBrasilia);
    const [encargos, setEncargos] = useState({ juros: "0.00", multa: "0.00", desconto: "0.00" });
    const [origens, setOrigens] = useState<Origem[]>([{ linha: 1, contaFinanceiraId: "", valor: "" }]);
    const [chave, setChave] = useState(() => crypto.randomUUID());
    const [pendente, setPendente] = useState<PagamentoMultiorigemInput | null>(null);
    const [processando, setProcessando] = useState(false);
    const [erro, setErro] = useState("");
    const enviando = useRef(false);
    const proximaLinha = useRef(2);
    const bloqueado = processando;
    const saldoPrincipal = centavosPagamento(String(conta.saldoPendente ?? conta.valor)) ?? 0n;
    const principal = tipo === "integral" ? decimalPagamento(saldoPrincipal) : principalParcial;
    const amortizacao = centavosPagamento(principal);
    const principalValido = amortizacao !== null && amortizacao > 0n && amortizacao <= saldoPrincipal;
    const calculo = calcularPagamento(principal, encargos.juros, encargos.multa, encargos.desconto);
    const linhas = origens.map(o => ({ ...o, valor: origens.length === 1 ? calculo?.valorPago ?? "" : o.valor }));
    const distribuido = linhas.reduce((soma, o) => soma + (centavosPagamento(o.valor) ?? 0n), 0n);
    const restante = calculo ? calculo.total - distribuido : null;
    const insuficiente = linhas.some(o => {
        const c = contasFinanceiras.find(c => c.id === o.contaFinanceiraId), valor = centavosPagamento(o.valor);
        return c && valor !== null && (centavosPagamento(String(c.saldoAtual)) ?? -1n) < valor;
    });
    const valido = principalValido && !!calculo && !!dataPagamento && restante === 0n && !insuficiente
        && new Set(linhas.map(o => o.contaFinanceiraId)).size === linhas.length
        && linhas.every(o => o.contaFinanceiraId && (centavosPagamento(o.valor) ?? 0n) > 0n
            && contasFinanceiras.some(c => c.id === o.contaFinanceiraId && c.ativo && c.tipo !== "ADQUIRENTE"));

    function editar(acao: () => void) {
        if (bloqueado) return;
        acao(); setErro(""); if (!pendente) setChave(crypto.randomUUID());
    }
    function alterarOrigem(linha: number, valores: Partial<Origem>) {
        editar(() => setOrigens(linhas.map(o => o.linha === linha ? { ...o, ...valores } : o)));
    }
    async function confirmar(evento: FormEvent) {
        evento.preventDefault();
        if (enviando.current || !valido) return;
        const pedido: PagamentoMultiorigemInput = {
            principalQuitado: decimalPagamento(amortizacao!),
            chaveRequisicao: pendente?.chaveRequisicao ?? chave, dataPagamento, valorPago: calculo!.valorPago, ...encargos,
            origens: linhas.map(o => ({ contaFinanceiraId: Number(o.contaFinanceiraId), valor: decimalPagamento(centavosPagamento(o.valor)!) })),
        };
        enviando.current = true; setProcessando(true); setErro("");
        const consultar = async () => {
            try { return await buscarPagamentoPorChave(conta.id, pedido.chaveRequisicao); }
            catch (e) { if (axios.isAxiosError(e) && e.response?.status === 404) return null; throw e; }
        };
        const concluir = (resultado: Awaited<ReturnType<typeof pagarContaMultiorigem>>) => {
            onConcluido(resultado.estado === "ESTORNADO"
                ? "Este pagamento já foi estornado. Nenhum novo débito foi realizado."
                : pendente ? "Pagamento confirmado. Consulte no histórico as origens efetivamente debitadas."
                : "Pagamento registrado. Todas as origens foram debitadas.");
        };
        try {
            // Um 404 não encerra a intenção: a tentativa antiga pode ainda chegar ao servidor.
            // Mesmo ao corrigir o formulário, a chave original disputa uma única baixa persistente.
            const existente = pendente ? await consultar() : null;
            concluir(existente ?? await pagarContaMultiorigem(conta.id, pedido));
        } catch (e) {
            if (axios.isAxiosError(e) && e.response?.status === 409) {
                try { const existente = await consultar(); if (existente) { concluir(existente); return; } }
                catch { setPendente(pedido); }
            }
            const incerto = !!pendente || !axios.isAxiosError(e) || !e.response || e.response.status >= 500;
            if (incerto) setPendente(pedido);
            setErro(mensagemContaPagar(e, "Não foi possível registrar o pagamento.") + (incerto
                ? " Você pode corrigir os dados aqui. Ao verificar novamente, consultaremos o pagamento anterior e impediremos uma segunda baixa. Não inicie outro pagamento deste título em outra tela." : ""));
        } finally { enviando.current = false; setProcessando(false); }
    }

    return <Dialog open fullWidth maxWidth="md" onClose={bloqueado || pendente ? undefined : onFechar} aria-labelledby="pagar-conta-titulo">
        <Box component="form" onSubmit={evento => void confirmar(evento)} sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <DialogTitle id="pagar-conta-titulo">Pagar conta</DialogTitle>
            <DialogContent dividers sx={{ p: { xs: 2, sm: 2.5 }, overscrollBehavior: "contain" }}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: { xs: 2.5, md: 3 }, alignItems: "start" }}>
                <Stack spacing={1.5} component="section" aria-label="Valores do pagamento" sx={{ minWidth: 0 }}>
                <Box><Typography sx={{ fontWeight: 600 }}>{conta.descricao}</Typography>
                    <Typography variant="body2" color="text.secondary">{conta.fornecedorNome ?? "Sem fornecedor"} · Vencimento: {formatarData(conta.dataVencimento)}</Typography></Box>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
                <CampoTexto required fullWidth type="date" label="Data do pagamento" value={dataPagamento} disabled={bloqueado}
                    onChange={e => editar(() => setDataPagamento(e.target.value))} slotProps={{ inputLabel: { shrink: true } }} />
                <CampoTexto select fullWidth label="Tipo de pagamento" value={tipo} disabled={bloqueado}
                    onChange={e => editar(() => setTipo(e.target.value))}>
                    <MenuItem value="integral">Quitar integralmente</MenuItem>
                    <MenuItem value="parcial">Pagamento parcial</MenuItem>
                </CampoTexto>
                </Box>
                <Typography variant="body2">Valor original: <strong>{moeda.format(conta.valor)}</strong></Typography>
                {(tipo === "parcial" || conta.status === "PARCIALMENTE_PAGA") && <Stack spacing={0.5}>
                    <Typography variant="body2">Principal já quitado: <strong>{moeda.format(conta.principalQuitado ?? 0)}</strong></Typography>
                    <Typography variant="body2">Saldo principal pendente: <strong>{moeda.format(Number(decimalPagamento(saldoPrincipal)))}</strong></Typography>
                </Stack>}
                {tipo === "parcial" && <CampoMonetario canonico required fullWidth label="Principal a pagar agora (R$)"
                    value={principalParcial} disabled={bloqueado} onValueChange={v => editar(() => setPrincipalParcial(v))}
                    error={principalParcial !== "" && !principalValido}
                    helperText={principalParcial !== "" && !principalValido ? "Informe um principal positivo, até o saldo pendente." : "Este valor amortiza a dívida; encargos e descontos pertencem somente a esta baixa."} />}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    {([ ["juros", "Juros (R$)"], ["multa", "Multa (R$)"], ["desconto", "Desconto (R$)"] ] as const).map(([campo, label]) =>
                        <CampoMonetario key={campo} canonico required fullWidth label={label} value={encargos[campo]} disabled={bloqueado}
                            onValueChange={v => editar(() => setEncargos(atual => ({ ...atual, [campo]: v })))} />)}
                </Stack>
                <Box role="status" aria-live="polite" sx={{ border: 1, borderColor: "divider", bgcolor: "action.hover", borderRadius: 1, p: 1.5, fontVariantNumeric: "tabular-nums" }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: "1.15rem" }}>Total a pagar: {calculo ? moeda.format(Number(calculo.valorPago)) : "Revise os valores"}</Typography>
                    <Typography variant="caption" color="text.secondary">{tipo === "integral" ? "Quitação integral do saldo pendente." : "Baixa do principal informado."} Este é o total debitado das contas financeiras.</Typography>
                    {principalValido && <Typography variant="body2" sx={{ mt: 0.5 }}>Saldo restante após pagamento: <strong>{moeda.format(Number(decimalPagamento(saldoPrincipal - amortizacao!)))}</strong></Typography>}
                </Box>
                </Stack>
                <Stack spacing={1.5} component="section" aria-label="Origens financeiras" sx={{ minWidth: 0 }}>
                <Typography component="h3" variant="subtitle2">De onde sairá o dinheiro?</Typography>
                {linhas.map((o, i) => {
                    const selecionada = contasFinanceiras.find(c => c.id === o.contaFinanceiraId);
                    const outros = distribuido - (centavosPagamento(o.valor) ?? 0n);
                    const completar = calculo ? calculo.total - outros : 0n;
                    return <Stack key={o.linha} spacing={1} sx={{ borderBottom: linhas.length > 1 ? 1 : 0, borderColor: "divider", pb: linhas.length > 1 ? 1.5 : 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                            <CampoTexto select required fullWidth label={i === 0 ? "Conta financeira" : `Conta financeira ${i + 1}`} value={o.contaFinanceiraId} disabled={bloqueado}
                                onChange={e => alterarOrigem(o.linha, { contaFinanceiraId: e.target.value ? Number(e.target.value) : "" })}>
                                <MenuItem value="">Selecione uma conta financeira</MenuItem>
                                {contasFinanceiras.filter(c => c.ativo && c.tipo !== "ADQUIRENTE").map(c => <MenuItem key={c.id} value={c.id}
                                    disabled={linhas.some(outro => outro.linha !== o.linha && outro.contaFinanceiraId === c.id)}>
                                    {c.nome} — {rotulosTipoContaFinanceira[c.tipo]}
                                </MenuItem>)}
                            </CampoTexto>
                            {linhas.length > 1 && <IconButton aria-label={`Remover origem ${i + 1}`} disabled={bloqueado}
                                onClick={() => editar(() => setOrigens(linhas.filter(atual => atual.linha !== o.linha)))}><DeleteOutlineRoundedIcon /></IconButton>}
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                            <CampoMonetario canonico required fullWidth label={`Valor da origem ${i + 1} (R$)`} value={o.valor}
                                disabled={bloqueado || linhas.length === 1} onValueChange={v => alterarOrigem(o.linha, { valor: v })} />
                            {linhas.length > 1 && <Button size="small" disabled={bloqueado || completar <= 0n} sx={{ flexShrink: 0 }}
                                onClick={() => alterarOrigem(o.linha, { valor: decimalPagamento(completar) })}>Usar restante</Button>}
                        </Stack>
                        {selecionada && <Typography variant="caption" color="text.secondary">Saldo disponível: {moeda.format(selecionada.saldoAtual)}. O saldo será validado novamente ao confirmar.</Typography>}
                    </Stack>;
                })}
                <Button startIcon={<AddRoundedIcon />} sx={{ alignSelf: "flex-start" }} disabled={bloqueado || linhas.length >= 10}
                    onClick={() => editar(() => setOrigens([...linhas, { linha: proximaLinha.current++, contaFinanceiraId: "", valor: decimalPagamento(restante !== null && restante > 0n ? restante : 0n) }]))}>
                    Adicionar outra origem
                </Button>
                {linhas.length > 1 && <Box aria-live="polite" sx={{ fontVariantNumeric: "tabular-nums" }}>
                    <Typography variant="body2">Total distribuído: <strong>{moeda.format(Number(decimalPagamento(distribuido)))}</strong></Typography>
                    <Typography variant="body2" color={restante === 0n ? "success.main" : "text.primary"}>
                        {restante === null ? "Revise o total a pagar." : restante < 0n
                            ? `Distribuído a mais: ${moeda.format(Number(decimalPagamento(-restante)))}`
                            : `Falta distribuir: ${moeda.format(Number(decimalPagamento(restante)))}`}
                    </Typography>
                </Box>}
                {insuficiente && <Alert severity="warning">Saldo insuficiente em uma das contas financeiras selecionadas.</Alert>}
                {erro && <Alert severity="error">{erro}</Alert>}
                </Stack></Box></DialogContent>
            <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
                <Button disabled={bloqueado || !!pendente} onClick={onFechar}>Cancelar</Button>
                <Button type="submit" variant="contained" disabled={processando || !valido}>
                    {processando ? "Verificando…" : pendente ? "Verificar pagamento" : "Confirmar pagamento"}
                </Button>
            </DialogActions>
        </Box>
    </Dialog>;
}
