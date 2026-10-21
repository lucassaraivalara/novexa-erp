import { Alert, Box, Stack, TextField, Typography } from "@mui/material";
import type { ConfiguracaoRecebimentos } from "../../services/configuracaoRecebimentosService";
import { conferenciaMeios } from "./conferenciaMeios";
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type Props = { politica: ConfiguracaoRecebimentos; conferencia: ReturnType<typeof conferenciaMeios>; valores: Record<string, string>;
    total: string; onValor: (chave: string, valor: string) => void; onTotal: (valor: string) => void; disabled: boolean };
export default function ConferenciaMeiosPagamento({ politica, conferencia, valores, total, onValor, onTotal, disabled }: Props) {
    return <Stack spacing={2}>
        <Typography component="h3" variant="subtitle1">Conferência dos meios não dinheiro</Typography>
        <Alert severity="info">Conferir não confirma PIX, não liquida cartão e não altera contas financeiras.</Alert>
        {conferencia.porTotal ? <Box><TextField label="Total conferido dos meios não dinheiro (R$)" name="totalConferido" autoComplete="off" fullWidth
            value={total} required={politica.exigirValoresInformadosNoFechamento} disabled={disabled} onChange={e => onTotal(e.target.value)}
            helperText={`Sistema: ${moeda.format(conferencia.esperado)}. Não inclui dinheiro físico nem saldo inicial.`}
            slotProps={{ htmlInput: { inputMode: "decimal" } }} />
            <Typography role="status" variant="caption" color="text.secondary">
                {conferencia.informado == null ? "Não informado" : `Diferença: ${moeda.format(Math.round((conferencia.informado - conferencia.esperado) * 100) / 100)}`}
            </Typography></Box>
            : conferencia.linhas.map(linha => <Box key={linha.chave}>
                <TextField fullWidth label={`Valor conferido de ${linha.descricao} (R$)`} name={`conferencia-${linha.chave}`} autoComplete="off"
                    value={valores[linha.chave] ?? ""} required={politica.exigirValoresInformadosNoFechamento} disabled={disabled}
                    onChange={e => onValor(linha.chave, e.target.value)} helperText={`Sistema: ${moeda.format(linha.total)}`}
                    slotProps={{ htmlInput: { inputMode: "decimal" } }} />
                <Typography role="status" variant="caption" color={linha.diferenca ? "warning.main" : "text.secondary"}>
                    {linha.diferenca == null ? "Não informado" : `Diferença: ${moeda.format(linha.diferenca)}`}
                </Typography>
            </Box>)}
        {!conferencia.porTotal && conferencia.linhas.length === 0 && <Typography variant="body2">Nenhum meio não dinheiro registrado nesta sessão.</Typography>}
    </Stack>;
}
