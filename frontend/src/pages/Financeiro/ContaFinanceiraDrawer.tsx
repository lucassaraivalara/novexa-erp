import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Box, Button, Link, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { mensagemContaFinanceira, salvarContaFinanceira } from "../../services/contaFinanceiraService";
import { rotulosTipoContaFinanceira, tiposContaFinanceiraFuncionais, type ContaFinanceira, type TipoContaFinanceira } from "../../types/contaFinanceira";
import { listarContasBancarias } from "../../services/dadosBancariosService";
import type { ContaBancariaResumo } from "../../types/dadosBancarios";
import CadastroDialog from "../../components/ui/CadastroDialog";

type Props = { conta: ContaFinanceira | null; onFechar: () => void; onSalvo: (conta: ContaFinanceira) => void };

export default function ContaFinanceiraDrawer({ conta, onFechar, onSalvo }: Props) {
    const [nome, setNome] = useState(conta?.nome ?? "");
    const [tipo, setTipo] = useState<TipoContaFinanceira>(conta?.tipo ?? "BANCO");
    const [saldoInicial, setSaldoInicial] = useState(conta ? String(conta.saldoInicial).replace(".", ",") : "0,00");
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [contaBancariaId, setContaBancariaId] = useState<number | "">(conta?.contaBancaria?.id ?? "");
    const [bancarias, setBancarias] = useState<ContaBancariaResumo[]>([]);
    const [carregandoBancarias, setCarregandoBancarias] = useState(true);
    const [erroBancarias, setErroBancarias] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const emAndamento = useRef(false);
    useEffect(() => {
        const controller = new AbortController();
        listarContasBancarias({ ativo: true }, controller.signal)
            .then((lista) => { if (!controller.signal.aborted) { setBancarias(lista); setErroBancarias(""); } })
            .catch(() => { if (!controller.signal.aborted) setErroBancarias("Não foi possível carregar as contas bancárias."); })
            .finally(() => { if (!controller.signal.aborted) setCarregandoBancarias(false); });
        return () => controller.abort();
    }, [tentativa]);
    const opcoesBancarias = bancarias.filter((b) => b.ativo);
    if (conta?.contaBancaria && !opcoesBancarias.some((b) => b.id === conta.contaBancaria?.id))
        opcoesBancarias.push(conta.contaBancaria);
    const tipos = [...tiposContaFinanceiraFuncionais];
    if (conta && !tipos.includes(conta.tipo)) tipos.push(conta.tipo);

    async function enviar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (salvando || emAndamento.current) return;
        if (tipo === "BANCO" && !contaBancariaId) {
            setErro("Selecione uma conta bancária para salvar.");
            return;
        }
        const saldo = Number(saldoInicial.replace(",", "."));
        if (!conta && (!Number.isFinite(saldo) || saldo < 0 || Math.abs(saldo * 100 - Math.round(saldo * 100)) > 0.000001)) {
            setErro("Informe um saldo inicial não negativo com até duas casas decimais.");
            return;
        }
        emAndamento.current = true; setSalvando(true); setErro("");
        try { onSalvo(await salvarContaFinanceira({ nome: nome.trim(), tipo,
            contaBancariaId: tipo === "BANCO" ? Number(contaBancariaId) : null,
            ...(!conta && { saldoInicial: saldo }) }, conta?.id)); }
        catch (e) { setErro(mensagemContaFinanceira(e, "Não foi possível salvar a conta.")); }
        finally { emAndamento.current = false; setSalvando(false); }
    }

    return <CadastroDialog aberto variante="compact" titulo={conta ? "Editar conta financeira" : "Nova conta financeira"}
        descricao="Identifique a conta financeira e seu vínculo bancário, quando houver."
        onFechar={onFechar} onSubmit={e => void enviar(e)} salvando={salvando}
        desabilitarSalvar={tipo === "BANCO" && (!contaBancariaId || carregandoBancarias)}>
            <Stack spacing={2}>
                {erro && <Alert severity="error">{erro}</Alert>}
                <Typography component="h3" variant="subtitle2">Identificação</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
                <TextField placeholder="Ex.: Conta principal…" autoFocus required fullWidth label="Nome" value={nome} onChange={(e) => setNome(e.target.value)}
                    slotProps={{ htmlInput: { maxLength: 150 } }} />
                <TextField select required fullWidth label="Tipo" value={tipo}
                    onChange={(e) => { const proximo = e.target.value as TipoContaFinanceira;
                        setTipo(proximo); if (proximo !== "BANCO") setContaBancariaId(""); }}>
                    {tipos.map((valor) => <MenuItem key={valor} value={valor}>{rotulosTipoContaFinanceira[valor]}</MenuItem>)}
                </TextField>
                </Box>
                {tipo === "BANCO" && <>
                    <Typography component="h3" variant="subtitle2" sx={{ pt: 0.5 }}>Vínculo bancário</Typography>
                    <Typography variant="body2" color="text.secondary">A conta financeira controla saldo e extrato. Banco, agência e conta são dados de identificação bancária.</Typography>
                    {conta?.tipo === "BANCO" && !conta.contaBancaria && <Alert severity="info">
                        Conta legada sem vínculo bancário. Selecione uma conta bancária para salvar a edição.
                    </Alert>}
                    {erroBancarias && <Alert severity="error" action={<Button color="inherit" onClick={() => {
                        setCarregandoBancarias(true); setTentativa((n) => n + 1);
                    }}>Tentar novamente</Button>}>{erroBancarias}</Alert>}
                    <TextField select required fullWidth label="Conta bancária" value={contaBancariaId}
                        disabled={carregandoBancarias || salvando}
                        onChange={(e) => setContaBancariaId(Number(e.target.value))}
                        helperText={carregandoBancarias ? "Carregando contas bancárias…" : undefined}
                        slotProps={{ select: { sx: { "& .MuiSelect-select": { whiteSpace: "normal" } } } }}>
                        {opcoesBancarias.map((b) => <MenuItem key={b.id} value={b.id} sx={{ whiteSpace: "normal" }}>
                            {b.bancoNome} · Ag. {b.agenciaNumero} · {b.tipo === "CORRENTE" ? "CC" : "CP"} {b.numero}{b.digito ? `-${b.digito}` : ""}{!b.ativo ? " (inativa)" : ""}
                        </MenuItem>)}
                    </TextField>
                    {!carregandoBancarias && !erroBancarias && opcoesBancarias.length === 0 && <Alert severity="info">
                        Nenhuma conta bancária ativa. Cadastre em{' '}
                        <Link href="/financeiro/dados-bancarios" target="_blank" rel="noopener noreferrer">Dados bancários (nova aba)</Link>.
                        <Button type="button" size="small" onClick={() => {
                            setCarregandoBancarias(true); setTentativa((n) => n + 1);
                        }}>Atualizar contas bancárias</Button>
                    </Alert>}
                </>}
                <Typography component="h3" variant="subtitle2" sx={{ pt: 0.5 }}>Saldos</Typography>
                {conta ? <Stack spacing={2} direction={{ xs: "column", sm: "row" }}>
                    <TextField fullWidth disabled label="Saldo inicial" value={conta.saldoInicial.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                    <TextField fullWidth disabled label="Saldo atual" value={conta.saldoAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                </Stack> : <TextField placeholder="Ex.: 1.234,56…" required fullWidth label="Saldo inicial (R$)" value={saldoInicial}
                    onChange={e => setSaldoInicial(e.target.value)} slotProps={{ htmlInput: { inputMode: "decimal" } }} />}
            </Stack>
    </CadastroDialog>;
}
