import { useState, type FormEvent } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Alert, Box, Button, Drawer, IconButton, Stack, TextField, ToggleButton,
    ToggleButtonGroup, Typography } from "@mui/material";
import { criarMovimentacaoFinanceira, mensagemContaFinanceira } from "../../services/contaFinanceiraService";
import type { ContaFinanceira, TipoMovimentacaoFinanceira } from "../../types/contaFinanceira";

type Props = { conta: ContaFinanceira; onFechar: () => void; onSalvo: () => void };
const hoje = () => {
    const data = new Date();
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
};

export default function MovimentacaoFinanceiraDrawer({ conta, onFechar, onSalvo }: Props) {
    const [tipo, setTipo] = useState<TipoMovimentacaoFinanceira>("ENTRADA");
    const [descricao, setDescricao] = useState("");
    const [valor, setValor] = useState("");
    const [dataMovimento, setDataMovimento] = useState(hoje());
    const [observacao, setObservacao] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");

    async function enviar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (salvando) return;
        const quantia = Number(valor.replace(",", "."));
        if (!Number.isFinite(quantia) || quantia <= 0 || Math.abs(quantia * 100 - Math.round(quantia * 100)) > 0.000001) {
            setErro("Informe um valor positivo com até duas casas decimais.");
            return;
        }
        setSalvando(true); setErro("");
        try {
            await criarMovimentacaoFinanceira({ contaFinanceiraId: conta.id, tipo,
                descricao: descricao.trim(), valor: quantia, dataMovimento, observacao: observacao.trim() || null });
            onSalvo();
        } catch (e) { setErro(mensagemContaFinanceira(e, "Não foi possível registrar a movimentação.")); }
        finally { setSalvando(false); }
    }

    return <Drawer anchor="right" open onClose={salvando ? undefined : onFechar}
        slotProps={{ paper: { "aria-labelledby": "movimentacao-financeira-titulo", sx: { width: { xs: "100%", sm: 480 }, maxWidth: "100vw" } } }}>
        <Box component="form" onSubmit={(e) => void enviar(e)} sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 3, py: 2, borderBottom: 1, borderColor: "divider" }}>
                <Typography id="movimentacao-financeira-titulo" variant="h6" component="h2">Nova movimentação</Typography>
                <IconButton aria-label="Fechar formulário" onClick={onFechar} disabled={salvando}><CloseRoundedIcon /></IconButton>
            </Stack>
            <Stack spacing={2.5} sx={{ p: 3, flex: 1, overflowY: "auto" }}>
                {erro && <Alert severity="error">{erro}</Alert>}
                <Stack>
                    <Typography variant="body2" color="text.secondary">{conta.nome}</Typography>
                    <Typography variant="h6">{conta.saldoAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Typography>
                </Stack>
                <ToggleButtonGroup exclusive fullWidth value={tipo} aria-label="Tipo de movimentação"
                    onChange={(_, valor: TipoMovimentacaoFinanceira | null) => { if (valor) setTipo(valor); }} size="small">
                    <ToggleButton value="ENTRADA">Entrada</ToggleButton>
                    <ToggleButton value="SAIDA">Saída</ToggleButton>
                </ToggleButtonGroup>
                <TextField autoFocus required fullWidth label="Descrição" value={descricao}
                    onChange={(e) => setDescricao(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
                <TextField required fullWidth label="Valor (R$)" value={valor}
                    onChange={(e) => setValor(e.target.value)} slotProps={{ htmlInput: { inputMode: "decimal" } }} />
                <TextField required fullWidth type="date" label="Data do movimento" value={dataMovimento}
                    onChange={(e) => setDataMovimento(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField fullWidth multiline minRows={3} label="Observação" value={observacao}
                    onChange={(e) => setObservacao(e.target.value)} slotProps={{ htmlInput: { maxLength: 1000 } }} />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", px: 3, py: 2, borderTop: 1, borderColor: "divider" }}>
                <Button onClick={onFechar} disabled={salvando}>Cancelar</Button>
                <Button type="submit" variant="contained" disabled={salvando}>{salvando ? "Salvando…" : "Registrar"}</Button>
            </Stack>
        </Box>
    </Drawer>;
}
