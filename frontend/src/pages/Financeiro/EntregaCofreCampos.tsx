import { useEffect, useState } from "react";
import { Alert, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { resumoCofre, type Cofre } from "../../services/cofreService";

import type { FormEntregaCofre } from "./cofreFormulario";

export default function EntregaCofreCampos({ value, onChange, valorFixo, disabled = false, devolucao = false }: {
    value: FormEntregaCofre; onChange: (value: FormEntregaCofre) => void; valorFixo?: number; disabled?: boolean; devolucao?: boolean;
}) {
    const [cofres, setCofres] = useState<Cofre[]>([]);
    const [erro, setErro] = useState("");
    useEffect(() => {
        const c = new AbortController();
        resumoCofre(c.signal).then(r => { if (!c.signal.aborted) setCofres(r.contas.filter(c => c.ativo)); })
            .catch(() => { if (!c.signal.aborted) setErro("Não foi possível consultar os cofres. Você pode fechar sem destinação e registrá-la depois em Contas e saldos."); });
        return () => c.abort();
    }, []);
    const alterar = (patch: Partial<FormEntregaCofre>) => onChange({ ...value, ...patch });
    return <Stack spacing={2} sx={{ minWidth: 0 }}>
        {erro && <Alert severity="warning">{erro}</Alert>}
        <TextField select fullWidth name="contaCofre" label="Conta COFRE" value={value.conta} disabled={disabled}
            helperText="Use uma conta COFRE ativa já cadastrada em Contas e saldos." onChange={e => alterar({ conta: e.target.value })}>
            <MenuItem value="">Selecione</MenuItem>{cofres.map(c => <MenuItem key={c.id} value={c.id}>{c.nome}</MenuItem>)}
        </TextField>
        {valorFixo === undefined && <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField fullWidth name="valorRecolhido" label={devolucao ? "Valor devolvido para troco (R$)" : "Valor enviado ao cofre (R$)"} value={value.valor} disabled={disabled}
                slotProps={{ htmlInput: { inputMode: "decimal" } }} onChange={e => alterar({ valor: e.target.value })} />
            {!devolucao && <TextField fullWidth name="valorTrocoMantido" label="Valor mantido para troco (R$)" value={value.troco} disabled={disabled}
                slotProps={{ htmlInput: { inputMode: "decimal" } }} onChange={e => alterar({ troco: e.target.value })} />}
        </Stack>}
        <TextField fullWidth name="responsavelCofre" label="Responsável pelo recebimento" value={value.responsavel} disabled={disabled}
            slotProps={{ htmlInput: { maxLength: 150 } }} onChange={e => alterar({ responsavel: e.target.value })} />
        <TextField fullWidth multiline minRows={2} name="observacaoCofre" label="Observação da entrega" value={value.observacao} disabled={disabled}
            slotProps={{ htmlInput: { maxLength: 500 } }} onChange={e => alterar({ observacao: e.target.value })} />
        <FormControlLabel control={<Checkbox checked={value.confirmar} disabled={disabled} onChange={e => alterar({ confirmar: e.target.checked })} />}
            label="Confirmo que o dinheiro foi entregue ao responsável informado" />
        <Typography variant="caption" color="text.secondary">{devolucao ? "A confirmação debita o cofre e registra suprimento na sessão, na mesma operação."
            : "Sem confirmação, o recolhimento fica pendente e não altera o saldo do cofre."} O usuário conectado fica registrado na confirmação.</Typography>
    </Stack>;
}
