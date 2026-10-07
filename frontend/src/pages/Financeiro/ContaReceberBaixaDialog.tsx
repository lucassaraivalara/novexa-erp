import axios from "axios";
import { useRef, useState, type FormEvent } from "react";
import { Alert, Autocomplete, Stack, TextField, Typography } from "@mui/material";
import CadastroDialog from "../../components/ui/CadastroDialog";
import { useRemoteSearch } from "../../hooks/useRemoteSearch";
import { listarContasFinanceirasPaginado, mensagemContaFinanceira } from "../../services/contaFinanceiraService";
import { mensagemContaReceber, receberConta } from "../../services/contaReceberService";
import type { ContaFinanceira } from "../../types/contaFinanceira";
import type { ContaReceber, RecebimentoContaInput } from "../../types/contaReceber";
import { obterSessao } from "../../utils/auth/sessao";
import { hoje, moeda, valorMonetario } from "./contaReceberUtils";

type Tentativa = { dados: RecebimentoContaInput; destino: ContaFinanceira };
type Props = { conta: ContaReceber; onFechar: () => void; onSalvo: (conta: ContaReceber) => void };

function lerTentativa(chave: string, conta: ContaReceber): Tentativa | null {
    try {
        const tentativa: Tentativa | null = JSON.parse(sessionStorage.getItem(chave) ?? "null");
        if (!tentativa?.dados?.chaveRequisicao || !tentativa.destino?.id) return null;
        if (conta.recebimentos.some(m => m.chaveRequisicao === tentativa.dados.chaveRequisicao && m.estornada)) {
            sessionStorage.removeItem(chave); return null;
        }
        return tentativa;
    } catch { return null; }
}

export default function ContaReceberBaixaDialog({ conta, onFechar, onSalvo }: Props) {
    const chave = `novexa-recebimento:${obterSessao()?.empresa?.id}:${conta.id}`;
    const [tentativa, setTentativa] = useState<Tentativa | null>(() => lerTentativa(chave, conta));
    const [destino, setDestino] = useState<ContaFinanceira | null>(tentativa?.destino ?? null);
    const [valor, setValor] = useState(String(tentativa?.dados.valor ?? conta.saldo).replace(".", ","));
    const [dataRecebimento, setDataRecebimento] = useState(tentativa?.dados.dataRecebimento ?? hoje());
    const [observacao, setObservacao] = useState(tentativa?.dados.observacao ?? "");
    const [opcoes, setOpcoes] = useState<ContaFinanceira[]>([]);
    const [erroBusca, setErroBusca] = useState("");
    const [erro, setErro] = useState("");
    const [salvando, setSalvando] = useState(false);
    const emAndamento = useRef(false);
    const bloqueado = salvando || tentativa !== null;
    const { setTerm, loading } = useRemoteSearch<ContaFinanceira>({ enabled: !bloqueado,
        search: async (termo, signal) => (await listarContasFinanceirasPaginado({ page: 0, size: 10, sort: "nome,asc", ativo: true, termo: termo || undefined }, signal)).items,
        onResults: items => { setOpcoes(items); setErroBusca(""); },
        onError: e => setErroBusca(mensagemContaFinanceira(e, "Não foi possível buscar as contas.")),
        onInvalidTerm: () => setOpcoes([]) });

    async function enviar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (emAndamento.current) return;
        const valorRecebido = valorMonetario(valor);
        if (!tentativa && (!destino?.ativo || !dataRecebimento || valorRecebido === null || Math.round(valorRecebido * 100) > Math.round(conta.saldo * 100))) {
            setErro("Selecione uma conta ativa, a data e um valor positivo de até " + moeda.format(conta.saldo) + "."); return;
        }
        const atual: Tentativa = tentativa ?? { destino: destino!, dados: { contaFinanceiraId: destino!.id,
            valor: valorRecebido!, dataRecebimento, observacao: observacao.trim() || null, chaveRequisicao: crypto.randomUUID() } };
        emAndamento.current = true; setSalvando(true); setErro("");
        try {
            // Preserva payload/chave antes do envio, inclusive se houver refresh ou perda de resposta.
            sessionStorage.setItem(chave, JSON.stringify(atual)); setTentativa(atual);
            const resposta = await receberConta(conta.id, atual.dados);
            sessionStorage.removeItem(chave); setTentativa(null); onSalvo(resposta);
        } catch (e) {
            const status = axios.isAxiosError(e) ? e.response?.status : undefined;
            if (status && status >= 400 && status < 500 && status !== 401 && status !== 408) {
                sessionStorage.removeItem(chave); setTentativa(null);
            }
            setErro(mensagemContaReceber(e, "Não foi possível registrar o recebimento."));
        } finally { emAndamento.current = false; setSalvando(false); }
    }

    return <CadastroDialog aberto variante="compact" titulo="Receber conta" textoSalvar={tentativa ? "Tentar novamente" : "Confirmar recebimento"}
        onFechar={onFechar} onSubmit={e => void enviar(e)} salvando={salvando}>
        <Stack spacing={2}>
            <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{conta.cliente.nome} · {conta.descricao}</Typography>
            <Typography sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>Saldo em aberto: {moeda.format(conta.saldo)}</Typography>
            {tentativa && <Alert severity="warning">Há um recebimento aguardando confirmação. Tente novamente com os mesmos dados para evitar duplicidade.</Alert>}
            <Autocomplete value={destino} options={destino && !opcoes.some(c => c.id === destino.id) ? [destino, ...opcoes] : opcoes}
                disabled={bloqueado} loading={loading} filterOptions={items => items}
                getOptionLabel={c => c.nome} isOptionEqualToValue={(a, b) => a.id === b.id}
                onChange={(_, c) => setDestino(c)} onInputChange={(_, texto, motivo) => { if (motivo === "input" || motivo === "clear") setTerm(texto); }}
                noOptionsText="Nenhuma conta ativa encontrada" loadingText="Buscando contas…"
                renderInput={params => <TextField {...params} required label="Conta de destino" error={!!erroBusca} helperText={erroBusca} />} />
            <TextField required label="Valor recebido (R$)" value={valor} disabled={bloqueado}
                onChange={e => setValor(e.target.value)} slotProps={{ htmlInput: { inputMode: "decimal" } }} />
            <TextField required type="date" label="Data do recebimento" value={dataRecebimento} disabled={bloqueado}
                onChange={e => setDataRecebimento(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField multiline minRows={2} label="Observação" value={observacao} disabled={bloqueado}
                onChange={e => setObservacao(e.target.value)} slotProps={{ htmlInput: { maxLength: 1000 } }} />
            {erro && <Alert severity="error">{erro}</Alert>}
        </Stack>
    </CadastroDialog>;
}
