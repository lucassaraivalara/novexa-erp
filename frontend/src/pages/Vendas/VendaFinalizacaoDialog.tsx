import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    Divider,
    Fade,
    Grow,
    LinearProgress,
    Stack,
    Typography,
} from "@mui/material";

export type EstadoFinalizacao = "processing" | "success" | "error";

type Props = {
    open: boolean;
    estado: EstadoFinalizacao;
    quantidadeItens: number;
    total: number;
    formaPagamento: string;
    troco: number;
    mensagemErro?: string;
    onVoltar: () => void;
    onTentarNovamente?: () => void;
};

const moeda = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
});

export default function VendaFinalizacaoDialog({
    open,
    estado,
    quantidadeItens,
    total,
    formaPagamento,
    troco,
    mensagemErro,
    onVoltar,
    onTentarNovamente,
}: Props) {
    const processando = estado === "processing";
    const sucesso = estado === "success";

    return <Dialog
        open={open}
        fullWidth
        maxWidth="xs"
        onClose={(_, motivo) => {
            if (estado === "error" && motivo !== "backdropClick") onVoltar();
        }}
        onKeyDown={evento => evento.stopPropagation()}
        aria-labelledby="finalizacao-venda-titulo"
        aria-describedby="finalizacao-venda-descricao"
        slotProps={{
            backdrop: { sx: { bgcolor: "rgba(15, 23, 42, 0.48)" } },
            paper: { sx: { borderRadius: 3, border: 1, borderColor: "divider", overflow: "hidden" } },
        }}>
        <Fade in key={estado} timeout={180}>
            <Box aria-live="polite">
                <DialogContent sx={{ p: 3 }}>
                    <Stack spacing={2.5} sx={{ alignItems: "center", textAlign: "center" }}>
                        {processando && <CircularProgress size={58} thickness={3.5} aria-label="Finalização em andamento" />}
                        {sucesso && <Grow in timeout={240}>
                            <CheckCircleRoundedIcon color="success" sx={{ fontSize: 72 }} aria-label="Venda concluída" />
                        </Grow>}
                        {estado === "error" && <ErrorOutlineRoundedIcon color="error" sx={{ fontSize: 66 }} aria-label="Falha na finalização" />}

                        <Box>
                            <Typography id="finalizacao-venda-titulo" variant="h5" sx={{ fontWeight: 750 }}>
                                {processando ? "Finalizando venda" : sucesso ? "Venda concluída" : "Não foi possível concluir"}
                            </Typography>
                            <Typography id="finalizacao-venda-descricao" color="text.secondary" sx={{ mt: 0.75 }}>
                                {processando
                                    ? "Aguarde enquanto o Novexa conclui a operação."
                                    : sucesso
                                        ? "Tudo certo. O caixa está pronto para a próxima venda."
                                        : mensagemErro}
                            </Typography>
                        </Box>

                        <Box sx={{ width: "100%", bgcolor: "action.hover", borderRadius: 2, p: 2 }}>
                            <Typography variant="caption" color="text.secondary">TOTAL</Typography>
                            <Typography sx={{ fontSize: 32, lineHeight: 1.2, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                                {moeda(total)}
                            </Typography>
                            <Divider sx={{ my: 1.5 }} />
                            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                                <Typography variant="body2" color="text.secondary">Itens</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 650 }}>{quantidadeItens}</Typography>
                            </Stack>
                            <Stack direction="row" sx={{ justifyContent: "space-between", mt: 0.75 }}>
                                <Typography variant="body2" color="text.secondary">Pagamento</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 650 }}>{formaPagamento}</Typography>
                            </Stack>
                            {troco > 0 && <Stack direction="row" sx={{ justifyContent: "space-between", mt: 0.75 }}>
                                <Typography variant="body2" color="text.secondary">Troco</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{moeda(troco)}</Typography>
                            </Stack>}
                        </Box>
                    </Stack>
                </DialogContent>
                {processando && <LinearProgress aria-label="Processando venda" />}
                {estado === "error" && <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button onClick={onVoltar}>Voltar à venda</Button>
                    {onTentarNovamente && <Button variant="contained" onClick={onTentarNovamente}>Tentar novamente</Button>}
                </DialogActions>}
            </Box>
        </Fade>
    </Dialog>;
}
