import { useRef, useState, type FormEvent } from "react";
import { Alert, Stack, TextField } from "@mui/material";
import CadastroDialog from "../../components/ui/CadastroDialog";
import ClienteAutocomplete from "../../components/clientes/ClienteAutocomplete";
import type { Cliente } from "../../types/cliente";
import type { ContaReceber, ContaReceberInput } from "../../types/contaReceber";
import { mensagemContaReceber, salvarContaReceber } from "../../services/contaReceberService";
import { valorMonetario } from "./contaReceberUtils";

type Props = { conta: ContaReceber | null; clienteInicial?: Cliente; onFechar: () => void; onSalvo: (conta: ContaReceber) => void };

export default function ContaReceberForm({ conta, clienteInicial, onFechar, onSalvo }: Props) {
    const [cliente, setCliente] = useState<Cliente | null>(clienteInicial ?? null);
    const [form, setForm] = useState({ descricao: conta?.descricao ?? "", valor: conta ? String(conta.valorOriginal).replace(".", ",") : "",
        dataEmissao: conta?.dataEmissao ?? "", dataVencimento: conta?.dataVencimento ?? "",
        numeroParcela: String(conta?.numeroParcela ?? 1), totalParcelas: String(conta?.totalParcelas ?? 1), observacao: conta?.observacao ?? "" });
    const [erro, setErro] = useState("");
    const [salvando, setSalvando] = useState(false);
    const emAndamento = useRef(false);
    const alterar = (campo: keyof typeof form, valor: string) => setForm(atual => ({ ...atual, [campo]: valor }));

    async function enviar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (emAndamento.current) return;
        const valor = valorMonetario(form.valor);
        const numeroParcela = Number(form.numeroParcela), totalParcelas = Number(form.totalParcelas);
        if (!cliente?.ativo) { setErro("Selecione um cliente ativo."); return; }
        if (!form.descricao.trim() || !form.dataVencimento) { setErro("Informe a descrição e o vencimento."); return; }
        if (valor === null) { setErro("Informe um valor positivo com até duas casas decimais."); return; }
        if (!Number.isInteger(numeroParcela) || !Number.isInteger(totalParcelas) || numeroParcela < 1 || totalParcelas < numeroParcela) {
            setErro("Informe parcelas válidas: a parcela deve estar entre 1 e o total."); return;
        }
        const dados: ContaReceberInput = { clienteId: cliente.id, descricao: form.descricao.trim(), valorOriginal: valor,
            dataEmissao: form.dataEmissao || null, dataVencimento: form.dataVencimento, numeroParcela, totalParcelas,
            observacao: form.observacao.trim() || null };
        emAndamento.current = true; setSalvando(true); setErro("");
        try { onSalvo(await salvarContaReceber(dados, conta?.id)); }
        catch (e) { setErro(mensagemContaReceber(e, "Não foi possível salvar a conta.")); }
        finally { emAndamento.current = false; setSalvando(false); }
    }

    return <CadastroDialog aberto variante="compact" titulo={conta ? "Editar conta a receber" : "Nova conta a receber"}
        onFechar={onFechar} onSubmit={e => void enviar(e)} salvando={salvando}>
        <Stack spacing={1.75}>
            {erro && <Alert severity="error">{erro}</Alert>}
            <ClienteAutocomplete label="Cliente *" value={cliente} onChange={setCliente} disabled={salvando} />
            {cliente && !cliente.ativo && <Alert severity="warning">O cliente está inativo. Selecione um cliente ativo para salvar.</Alert>}
            <TextField required autoFocus label="Descrição" value={form.descricao} disabled={salvando}
                onChange={e => alterar("descricao", e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField required fullWidth label="Valor original (R$)" value={form.valor} disabled={salvando}
                onChange={e => alterar("valor", e.target.value)} slotProps={{ htmlInput: { inputMode: "decimal" } }} />
                <TextField required fullWidth type="date" label="Vencimento" value={form.dataVencimento} disabled={salvando}
                    onChange={e => alterar("dataVencimento", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
            <Stack direction="row" spacing={1.5}>
                <TextField fullWidth type="number" label="Parcela" value={form.numeroParcela} disabled={salvando}
                    onChange={e => alterar("numeroParcela", e.target.value)} slotProps={{ htmlInput: { min: 1, step: 1 } }} />
                <TextField fullWidth type="number" label="Total de parcelas" value={form.totalParcelas} disabled={salvando}
                    onChange={e => alterar("totalParcelas", e.target.value)} slotProps={{ htmlInput: { min: 1, step: 1 } }} />
            </Stack>
            <TextField fullWidth type="date" label="Emissão" value={form.dataEmissao} disabled={salvando}
                onChange={e => alterar("dataEmissao", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField multiline minRows={2} label="Observação" value={form.observacao} disabled={salvando}
                onChange={e => alterar("observacao", e.target.value)} slotProps={{ htmlInput: { maxLength: 1000 } }} />
        </Stack>
    </CadastroDialog>;
}
