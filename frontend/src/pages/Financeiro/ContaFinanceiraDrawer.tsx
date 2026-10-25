import { numeroDecimal } from "../../utils/numeroFormulario";
import CampoTexto from "../../components/ui/CampoTexto";
import { CampoMonetario } from "../../components/ui/CampoDecimal";
import { useEffect, useState, type FormEvent } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Alert, Box, Button, Drawer, IconButton, Link, MenuItem, Stack, Typography } from "@mui/material";
import { mensagemContaFinanceira, salvarContaFinanceira } from "../../services/contaFinanceiraService";
import { rotulosTipoContaFinanceira, tiposContaFinanceiraFuncionais, type ContaFinanceira, type TipoContaFinanceira } from "../../types/contaFinanceira";
import { listarContasBancarias } from "../../services/dadosBancariosService";
import type { ContaBancariaResumo } from "../../types/dadosBancarios";

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
        if (salvando) return;
        if (tipo === "BANCO" && !contaBancariaId) {
            setErro("Selecione uma conta bancária para salvar.");
            return;
        }
        const saldo = numeroDecimal(saldoInicial, 2);
        if (!conta && (saldo === null || saldo < 0 || Math.abs(saldo * 100 - Math.round(saldo * 100)) > 0.000001)) {
            setErro("Informe um saldo inicial não negativo com até duas casas decimais.");
            return;
        }
        setSalvando(true); setErro("");
        try { onSalvo(await salvarContaFinanceira({ nome: nome.trim(), tipo,
            contaBancariaId: tipo === "BANCO" ? Number(contaBancariaId) : null,
            ...(!conta && { saldoInicial: saldo! }) }, conta?.id)); }
        catch (e) { setErro(mensagemContaFinanceira(e, "Não foi possível salvar a conta.")); }
        finally { setSalvando(false); }
    }

    return <Drawer anchor="right" open onClose={salvando ? undefined : onFechar}
        slotProps={{ paper: { "aria-labelledby": "conta-financeira-titulo", sx: { width: { xs: "100%", sm: 480 }, maxWidth: "100vw" } } }}>
        <Box component="form" onSubmit={(e) => void enviar(e)} sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 3, py: 2, borderBottom: 1, borderColor: "divider" }}>
                <Typography id="conta-financeira-titulo" variant="h6" component="h2">{conta ? "Editar conta financeira" : "Nova conta financeira"}</Typography>
                <IconButton aria-label="Fechar formulário" onClick={onFechar} disabled={salvando}><CloseRoundedIcon /></IconButton>
            </Stack>
            <Stack spacing={2} sx={{ p: 3, flex: 1, overflowY: "auto" }}>
                {erro && <Alert severity="error">{erro}</Alert>}
                <CampoTexto placeholder="Ex.: Conta principal…" autoFocus required fullWidth label="Nome" value={nome} onChange={(e) => setNome(e.target.value)}
                    slotProps={{ htmlInput: { maxLength: 150 } }} />
                <CampoTexto select required fullWidth label="Tipo" value={tipo}
                    onChange={(e) => { const proximo = e.target.value as TipoContaFinanceira;
                        setTipo(proximo); if (proximo !== "BANCO") setContaBancariaId(""); }}>
                    {tipos.map((valor) => <MenuItem key={valor} value={valor}>{rotulosTipoContaFinanceira[valor]}</MenuItem>)}
                </CampoTexto>
                {tipo === "BANCO" && <>
                    <Typography variant="body2" color="text.secondary">
                        A conta financeira controla saldo e extrato. Os dados bancários identificam banco, agência e conta.
                    </Typography>
                    {conta?.tipo === "BANCO" && !conta.contaBancaria && <Alert severity="info">
                        Conta legada sem vínculo bancário. Selecione uma conta bancária para salvar a edição.
                    </Alert>}
                    {erroBancarias && <Alert severity="error" action={<Button color="inherit" onClick={() => {
                        setCarregandoBancarias(true); setTentativa((n) => n + 1);
                    }}>Tentar novamente</Button>}>{erroBancarias}</Alert>}
                    <CampoTexto select required fullWidth label="Conta bancária" value={contaBancariaId}
                        disabled={carregandoBancarias || salvando}
                        onChange={(e) => setContaBancariaId(Number(e.target.value))}
                        helperText={carregandoBancarias ? "Carregando contas bancárias…" : undefined}
                        slotProps={{ select: { sx: { "& .MuiSelect-select": { whiteSpace: "normal" } } } }}>
                        {opcoesBancarias.map((b) => <MenuItem key={b.id} value={b.id} sx={{ whiteSpace: "normal" }}>
                            {b.bancoNome} · Ag. {b.agenciaNumero} · {b.tipo === "CORRENTE" ? "CC" : "CP"} {b.numero}{b.digito ? `-${b.digito}` : ""}{!b.ativo ? " (inativa)" : ""}
                        </MenuItem>)}
                    </CampoTexto>
                    {!carregandoBancarias && !erroBancarias && opcoesBancarias.length === 0 && <Alert severity="info">
                        Nenhuma conta bancária ativa. Cadastre em{' '}
                        <Link href="/financeiro/dados-bancarios" target="_blank" rel="noopener noreferrer">Dados bancários (nova aba)</Link>.
                        <Button type="button" size="small" onClick={() => {
                            setCarregandoBancarias(true); setTentativa((n) => n + 1);
                        }}>Atualizar contas bancárias</Button>
                    </Alert>}
                </>}
                {conta ? <Stack spacing={2} direction={{ xs: "column", sm: "row" }}>
                    <CampoTexto fullWidth disabled label="Saldo inicial" value={conta.saldoInicial.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                    <CampoTexto fullWidth disabled label="Saldo atual" value={conta.saldoAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                </Stack> : <CampoMonetario canonico placeholder="Ex.: 1.234,56…" required fullWidth label="Saldo inicial (R$)" value={saldoInicial}
                    onValueChange={v => setSaldoInicial(v)}  />}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", px: 3, py: 2, borderTop: 1, borderColor: "divider" }}>
                <Button onClick={onFechar} disabled={salvando}>Cancelar</Button>
                <Button type="submit" variant="contained" disabled={salvando || (tipo === "BANCO" && (!contaBancariaId || carregandoBancarias))}>{salvando ? "Salvando…" : "Salvar"}</Button>
            </Stack>
        </Box>
    </Drawer>;
}
