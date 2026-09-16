import { useId, type FormEventHandler, type ReactNode } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Typography,
    useMediaQuery,
    useTheme,
} from "@mui/material";

type CadastroDialogProps = {
    aberto: boolean;
    variante: "compact" | "full";
    titulo: string;
    descricao?: string;
    children: ReactNode;
    navegacao?: ReactNode;
    salvando?: boolean;
    desabilitarSalvar?: boolean;
    textoSalvar?: string;
    textoCancelar?: string;
    onFechar: () => void;
    onSubmit: FormEventHandler<HTMLFormElement>;
};

export default function CadastroDialog({
    aberto,
    variante,
    titulo,
    descricao,
    children,
    navegacao,
    salvando = false,
    desabilitarSalvar = false,
    textoSalvar = "Salvar",
    textoCancelar = "Cancelar",
    onFechar,
    onSubmit,
}: CadastroDialogProps) {
    const theme = useTheme();
    const telaPequena = useMediaQuery(theme.breakpoints.down("sm"));
    const tituloId = useId();
    const largura = variante === "compact" ? 680 : 1000;

    return <Dialog
        open={aberto}
        onClose={salvando ? undefined : onFechar}
        fullScreen={telaPequena}
        fullWidth
        maxWidth={false}
        aria-labelledby={tituloId}
        slotProps={{
            paper: {
                sx: {
                    width: largura,
                    maxWidth: { xs: "100%", sm: "calc(100vw - 32px)" },
                    maxHeight: { xs: "100%", sm: "84vh" },
                    border: { sm: 1 },
                    borderColor: "divider",
                    borderRadius: { xs: 0, sm: 2 },
                    overflow: "hidden",
                    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.16)",
                },
            },
        }}>
        <Box component="form" onSubmit={onSubmit} noValidate
            sx={{ display: "flex", flexDirection: "column", minHeight: 0, maxHeight: "inherit", overflow: "hidden" }}>
            <DialogTitle component="div" sx={{ flex: "0 0 auto", px: { xs: 2, sm: 3 }, py: 2, pr: 7, position: "relative" }}>
                <Typography id={tituloId} variant="h5" sx={{ fontWeight: 750 }}>{titulo}</Typography>
                {descricao && <Typography color="text.secondary" variant="body2" sx={{ mt: 0.375 }}>{descricao}</Typography>}
                <IconButton aria-label="Fechar" onClick={onFechar} disabled={salvando}
                    sx={{ position: "absolute", top: 12, right: 16 }}>
                    <CloseRoundedIcon />
                </IconButton>
            </DialogTitle>

            {navegacao && <Box sx={{ flex: "0 0 auto", borderBottom: 1, borderColor: "divider" }}>{navegacao}</Box>}

            <DialogContent dividers={!navegacao} sx={{
                flex: "1 1 auto",
                minHeight: 0,
                overflowY: "auto",
                px: { xs: 2, sm: 3 },
                py: 2,
                "& .MuiOutlinedInput-root:not(.MuiInputBase-multiline)": { minHeight: 44 },
                "& .MuiOutlinedInput-input:not(textarea), & .MuiSelect-select": { py: 1.25 },
                "& .MuiInputLabel-root:not(.MuiInputLabel-shrink)": { transform: "translate(14px, 11px) scale(1)" },
            }}>
                {children}
            </DialogContent>

            <DialogActions sx={{ flex: "0 0 auto", px: { xs: 2, sm: 3 }, py: 1.5, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
                <Button onClick={onFechar} disabled={salvando}>{textoCancelar}</Button>
                <Button type="submit" variant="contained" disableElevation disabled={salvando || desabilitarSalvar}
                    startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : undefined}>
                    {salvando ? "Salvando…" : textoSalvar}
                </Button>
            </DialogActions>
        </Box>
    </Dialog>;
}
