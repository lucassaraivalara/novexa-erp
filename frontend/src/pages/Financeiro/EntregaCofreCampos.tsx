import { useEffect, useState } from "react";
import { Alert, Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography } from "@mui/material";
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
    return <Stack spacing={2} sx={{ minWidth: 0 }}>
        {erro && <Alert severity="warning" action={<Button disabled={disabled} color="inherit" onClick={() => setTentativa(t => t + 1)}>Tentar novamente</Button>}>{erro}</Alert>}
        {(!fechamento || recolhe) && <TextField select fullWidth name="contaCofre" label="Conta COFRE" value={value.conta} disabled={disabled}
            helperText="Use uma conta COFRE ativa já cadastrada em Contas e saldos." onChange={e => alterar({ conta: e.target.value })}>
            <MenuItem value="">Selecione</MenuItem>{cofres.map(c => <MenuItem key={c.id} value={c.id}>{c.nome}</MenuItem>)}
        </TextField>}
        {valorFixo === undefined && <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField fullWidth name="valorRecolhido" label={devolucao ? "Valor devolvido para troco (R$)" : "Recolher ao cofre (R$)"} value={value.valor} disabled={disabled}
                slotProps={{ htmlInput: { inputMode: "decimal" } }} onChange={e => alterar({ valor: e.target.value })} />
            {!devolucao && <TextField fullWidth name="valorTrocoMantido" label="Valor mantido para troco (R$)" value={value.troco} disabled={disabled}
                slotProps={{ htmlInput: { inputMode: "decimal" } }} onChange={e => alterar({ troco: e.target.value })} />}
        </Stack>}
        {fechamento && <Typography role="status" aria-live="polite" variant="body2" color={confere ? "success.main" : "text.secondary"}>
            {confere ? "Troco + recolhimento = dinheiro contado. Destinação completa." : "Troco + recolhimento devem somar exatamente o dinheiro contado."}
        </Typography>}
        {(!fechamento || recolhe) && <TextField fullWidth name="responsavelCofre" label="Responsável pelo recebimento" value={value.responsavel} disabled={disabled}
            slotProps={{ htmlInput: { maxLength: 150 } }} onChange={e => alterar({ responsavel: e.target.value })} />}
        <TextField fullWidth multiline minRows={2} name="observacaoCofre" label="Observação da entrega" value={value.observacao} disabled={disabled}
            slotProps={{ htmlInput: { maxLength: 500 } }} onChange={e => alterar({ observacao: e.target.value })} />
        {(!fechamento || recolhe) && <FormControlLabel control={<Checkbox checked={value.confirmar} disabled={disabled} onChange={e => alterar({ confirmar: e.target.checked })} />}
            label="Confirmo que o dinheiro foi entregue ao responsável informado" />}
        <Typography variant="caption" color="text.secondary">{devolucao ? "A confirmação debita o cofre e registra suprimento na sessão, na mesma operação."
            : fechamento && !recolhe ? "O troco permanece neste Caixa físico e será sugerido na próxima abertura. Nenhum valor é creditado ao cofre."
            : "Sem confirmação, o recolhimento fica pendente e não altera o saldo do cofre."} O usuário conectado fica registrado na confirmação.</Typography>
    </Stack>;
}
