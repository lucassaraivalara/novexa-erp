import { useState, type FormEvent } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Alert, Box, Button, Drawer, IconButton, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { criarTransferenciaFinanceira, mensagemContaFinanceira } from "../../services/contaFinanceiraService";
import { tiposContaFinanceiraFuncionais, type ContaFinanceira } from "../../types/contaFinanceira";

type Props = { contas: ContaFinanceira[]; origemId?: number; onFechar: () => void; onSalvo: () => void };
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => {
    const data = new Date();
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
};

export default function TransferenciaFinanceiraDrawer({ contas, origemId, onFechar, onSalvo }: Props) {
    const [origem, setOrigem] = useState(origemId ?? "");
    const [destino, setDestino] = useState<number | "">("");
    const [valor, setValor] = useState("");
    const [dataMovimento, setDataMovimento] = useState(hoje);
    const [observacao, setObservacao] = useState("");
    const [chaveRequisicao] = useState(() => crypto.randomUUID());
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const permitidas = contas.filter((conta) => conta.ativo && tiposContaFinanceiraFuncionais.includes(conta.tipo));
    const contaOrigem = permitidas.find((conta) => conta.id === origem);

    async function enviar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (salvando) return;
        const quantia = Number(valor.replace(",", "."));
        if (!contaOrigem || !destino || origem === destino) { setErro("Selecione contas diferentes."); return; }
        if (!Number.isFinite(quantia) || quantia <= 0 || Math.abs(quantia * 100 - Math.round(quantia * 100)) > 0.000001) {
            setErro("Informe um valor positivo com até duas casas decimais."); return;
        }
        if (quantia > contaOrigem.saldoAtual) { setErro("Saldo insuficiente na conta de origem."); return; }
        setSalvando(true); setErro("");
        try {
            await criarTransferenciaFinanceira({ chaveRequisicao, contaOrigemId: contaOrigem.id,
                contaDestinoId: destino, valor: quantia, dataMovimento, observacao: observacao.trim() || null });
            onSalvo();
        } catch (e) { setErro(mensagemContaFinanceira(e, "Não foi possível realizar a transferência.")); }
        finally { setSalvando(false); }
    }

    return <Drawer anchor="right" open onClose={salvando ? undefined : onFechar}
        slotProps={{ paper: { "aria-labelledby": "transferencia-financeira-titulo", sx: { width: { xs: "100%", sm: 480 }, maxWidth: "100vw" } } }}>
        <Box component="form" onSubmit={(e) => void enviar(e)} sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 3, py: 2, borderBottom: 1, borderColor: "divider" }}>
                <Typography id="transferencia-financeira-titulo" variant="h6" component="h2">Transferir entre contas</Typography>
                <IconButton aria-label="Fechar transferência" onClick={onFechar} disabled={salvando}><CloseRoundedIcon /></IconButton>
            </Stack>
            <Stack spacing={2.5} sx={{ p: 3, flex: 1, overflowY: "auto" }}>
                {erro && <Alert severity="error">{erro}</Alert>}
                <TextField select required fullWidth label="Conta de origem" value={origem} disabled={salvando}
                    onChange={(e) => { const id = Number(e.target.value); setOrigem(id); if (destino === id) setDestino(""); }}>
                    {permitidas.map((conta) => <MenuItem key={conta.id} value={conta.id}>{conta.nome}</MenuItem>)}
                </TextField>
                {contaOrigem && <Typography variant="body2" color="text.secondary">Saldo disponível: {moeda.format(contaOrigem.saldoAtual)}</Typography>}
                <TextField select required fullWidth label="Conta de destino" value={destino} disabled={salvando}
                    onChange={(e) => setDestino(Number(e.target.value))}>
                    {permitidas.filter((conta) => conta.id !== origem).map((conta) =>
                        <MenuItem key={conta.id} value={conta.id}>{conta.nome}</MenuItem>)}
                </TextField>
                <TextField required fullWidth label="Valor (R$)" value={valor} disabled={salvando}
                    onChange={(e) => setValor(e.target.value)} slotProps={{ htmlInput: { inputMode: "decimal" } }} />
                <TextField required fullWidth type="date" label="Data do movimento" value={dataMovimento} disabled={salvando}
                    onChange={(e) => setDataMovimento(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField fullWidth multiline minRows={3} label="Observação" value={observacao} disabled={salvando}
                    onChange={(e) => setObservacao(e.target.value)} slotProps={{ htmlInput: { maxLength: 1000 } }} />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", px: 3, py: 2, borderTop: 1, borderColor: "divider" }}>
                <Button onClick={onFechar} disabled={salvando}>Cancelar</Button>
                <Button type="submit" variant="contained" disabled={salvando || !contaOrigem || !destino}>
                    {salvando ? "Transferindo..." : "Confirmar transferência"}
                </Button>
            </Stack>
        </Box>
    </Drawer>;
}
