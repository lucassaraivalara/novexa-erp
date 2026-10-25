import CampoTexto from "../../components/ui/CampoTexto";
import { CampoMonetario } from "../../components/ui/CampoDecimal";
import { useEffect, useState } from "react";
import { Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Stack, Typography } from "@mui/material";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import { resumoCofre, type Cofre } from "../../services/cofreService";

import type { FormEntregaCofre } from "./cofreFormulario";
import { centavosDinheiro } from "./cofreFormulario";

export default function EntregaCofreCampos({ value, onChange, valorFixo, disabled = false, devolucao = false, valorContado }: {
    value: FormEntregaCofre; onChange: (value: FormEntregaCofre) => void; valorFixo?: number; disabled?: boolean; devolucao?: boolean;
    valorContado?: number | null;
}) {
    const [cofres, setCofres] = useState<Cofre[]>([]);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    useEffect(() => {
        const c = new AbortController();
        resumoCofre(c.signal).then(r => { if (!c.signal.aborted) { setCofres(r.contas.filter(c => c.ativo)); setErro(""); } })
            .catch(() => { if (!c.signal.aborted) setErro("Não foi possível consultar os cofres. Tente novamente para selecionar o destino do recolhimento."); });
        return () => c.abort();
    }, [tentativa]);
    const alterar = (patch: Partial<FormEntregaCofre>) => onChange({ ...value, ...patch });
    const fechamento = valorContado !== undefined;
    const recolhe = (centavosDinheiro(value.valor) ?? 0) > 0;
    const troco = centavosDinheiro(value.troco);
    const recolhido = centavosDinheiro(value.valor);
    const confere = valorContado != null && troco !== null && recolhido !== null && troco + recolhido === Math.round(valorContado * 100);
    const contado = valorContado == null ? null : Math.round(valorContado * 100);
    const diferenca = contado !== null && troco !== null && recolhido !== null ? contado - troco - recolhido : null;
    const moeda = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    function destinar(campo: "troco" | "valor", texto: string) {
        const informado = centavosDinheiro(texto);
        alterar({ [campo]: texto, ...(fechamento && contado !== null && informado !== null
            ? { [campo === "troco" ? "valor" : "troco"]: (Math.max(0, contado - informado) / 100).toFixed(2).replace(".", ",") } : {}) });
    }
    const campoCofre = <CampoMonetario canonico placeholder="Ex.: 1.234,56…" fullWidth size={fechamento ? "small" : "medium"} name="valorRecolhido" label={devolucao ? "Valor devolvido para troco (R$)" : "Recolher ao cofre (R$)"} value={value.valor} disabled={disabled}
        sx={fechamento ? { "& .MuiInputBase-root": { minHeight: 44 } } : undefined}
        error={fechamento && contado !== null && recolhido !== null && recolhido > contado}
        helperText={fechamento && contado !== null && recolhido !== null && recolhido > contado ? "O recolhimento não pode exceder o dinheiro contado." : undefined}
         onValueChange={v => destinar("valor", v)} />;
    const campoTroco = <CampoMonetario canonico placeholder="Ex.: 1.234,56…" fullWidth size={fechamento ? "small" : "medium"} name="valorTrocoMantido" label="Valor mantido para troco (R$)" value={value.troco} disabled={disabled}
        sx={fechamento ? { "& .MuiInputBase-root": { minHeight: 44 } } : undefined}
        error={fechamento && contado !== null && troco !== null && troco > contado}
        helperText={fechamento && contado !== null && troco !== null && troco > contado ? "O troco não pode exceder o dinheiro contado." : undefined}
         onValueChange={v => destinar("troco", v)} />;
    return <Stack spacing={fechamento ? 1.5 : 2} sx={{ minWidth: 0 }}>
        {erro && <Alert severity="warning" action={<Button disabled={disabled} color="inherit" onClick={() => setTentativa(t => t + 1)}>Tentar novamente</Button>}>{erro}</Alert>}
        {fechamento && <>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
                <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 1.5, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}><AccountBalanceWalletOutlinedIcon color="primary" /><Typography variant="subtitle2">Manter para troco</Typography></Stack>{campoTroco}
                </Box>
                <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 1.5, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}><AccountBalanceOutlinedIcon color="primary" /><Typography variant="subtitle2">Recolher ao cofre</Typography></Stack>{campoCofre}
                </Box>
            </Box>
            <Alert role="status" aria-live="polite" severity={confere ? "success" : diferenca !== null ? "warning" : "info"}>
                {confere ? `Distribuição completa: ${moeda(contado!)} de ${moeda(contado!)}.`
                    : diferenca !== null ? diferenca > 0 ? `Falta destinar ${moeda(diferenca)} do dinheiro contado.` : `A distribuição excede o dinheiro contado em ${moeda(-diferenca)}.`
                    : "Informe o dinheiro contado para conferir a destinação entre troco e cofre."}
            </Alert>
        </>}
        {(!fechamento || recolhe) && <CampoTexto select fullWidth name="contaCofre" label="Conta COFRE" value={value.conta} disabled={disabled}
            required={fechamento && recolhe}
            helperText="Use uma conta COFRE ativa já cadastrada em Contas e saldos." onChange={e => alterar({ conta: e.target.value })}>
            <MenuItem value="">Selecione</MenuItem>{cofres.map(c => <MenuItem key={c.id} value={c.id}>{c.nome}</MenuItem>)}
        </CampoTexto>}
        {!fechamento && valorFixo === undefined && <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            {campoCofre}{!devolucao && campoTroco}
        </Stack>}
        {(!fechamento || recolhe) && <CampoTexto placeholder="Nome de quem recebeu o dinheiro…" fullWidth name="responsavelCofre" label="Responsável pelo recebimento" value={value.responsavel} disabled={disabled}
            required={fechamento && recolhe}
            slotProps={{ htmlInput: { maxLength: 150 } }} onChange={e => alterar({ responsavel: e.target.value })} />}
        <CampoTexto fullWidth multiline minRows={2} name="observacaoCofre" label={fechamento ? "Observação da entrega (opcional)" : "Observação da entrega"} value={value.observacao} disabled={disabled}
            slotProps={{ htmlInput: { maxLength: 500 } }} onChange={e => alterar({ observacao: e.target.value })} />
        {(!fechamento || recolhe) && <FormControlLabel control={<Checkbox checked={value.confirmar} disabled={disabled} onChange={e => alterar({ confirmar: e.target.checked })} />}
            label="Confirmo que o dinheiro foi entregue ao responsável informado" />}
        <Typography variant="caption" color="text.secondary">{fechamento ? recolhe ? "Sem confirmação de entrega, o recolhimento fica pendente e não altera o saldo do cofre." : "O troco permanece neste Caixa físico para a próxima abertura."
            : devolucao ? "A confirmação debita o cofre e registra suprimento na sessão, na mesma operação."
            : fechamento && !recolhe ? "O troco permanece neste Caixa físico e será sugerido na próxima abertura. Nenhum valor é creditado ao cofre."
            : "Sem confirmação, o recolhimento fica pendente e não altera o saldo do cofre."}{!fechamento && " O usuário conectado fica registrado na confirmação."}</Typography>
    </Stack>;
}
