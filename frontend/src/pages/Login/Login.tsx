import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
    Alert,
    Box,
    Button,
    Chip,
    IconButton,
    InputAdornment,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { realizarLogin } from "../../services/authService";
import { salvarSessao } from "../../utils/auth/sessao";
import { formatarCPF } from "../../utils/masks/cpfMask";
import { validarCPF } from "../../utils/validators/cpfValidator";

const modulos = ["Vendas", "Estoque", "Clientes", "Compras", "Financeiro", "PDV"];

function Login() {
    const navigate = useNavigate();
    const [cpf, setCpf] = useState("");
    const [senha, setSenha] = useState("");
    const [erroCPF, setErroCPF] = useState("");
    const [erroLogin, setErroLogin] = useState("");
    const [carregando, setCarregando] = useState(false);
    const [mostrarSenha, setMostrarSenha] = useState(false);

    async function handleLogin(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        if (carregando) {
            return;
        }

        if (!validarCPF(cpf)) {
            setErroCPF("Informe um CPF válido.");
            return;
        }

        if (!senha.trim()) {
            setErroLogin("Informe sua senha.");
            return;
        }

        setErroCPF("");
        setErroLogin("");
        setCarregando(true);

        try {
            const dados = await realizarLogin({
                cpf: cpf.replace(/\D/g, ""),
                senha,
            });

            salvarSessao({
                id: dados.id,
                nomeUsuario: dados.nomeUsuario,
                cpf: dados.cpf,
                email: dados.email,
                perfil: dados.perfil,
                empresa: dados.empresa,
                autenticadoEm: new Date().toISOString(),
            });

            navigate("/dashboard", { replace: true });
        } catch (erro) {
            const mensagem =
                erro instanceof Error ? erro.message : "Não foi possível entrar.";

            setErroLogin(mensagem);
        } finally {
            setCarregando(false);
        }
    }

    return (
        <Box
            sx={{
                display: "grid",
                minHeight: "100vh",
                gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.35fr) minmax(460px, 0.9fr)" },
                backgroundColor: "#FFFFFF",
            }}
        >
            <Box
                sx={{
                    display: { xs: "none", lg: "flex" },
                    flexDirection: "column",
                    justifyContent: "space-between",
                    position: "relative",
                    overflow: "hidden",
                    px: { lg: 6, xl: 8 },
                    py: { lg: 5, xl: 6 },
                    color: "#E2ECFA",
                    background:
                        "radial-gradient(circle at 82% 34%, rgba(14, 165, 233, 0.18) 0 4px, transparent 5px), radial-gradient(circle at 42% 70%, rgba(14, 165, 233, 0.15) 0 4px, transparent 5px), linear-gradient(135deg, #071B35 0%, #0A2444 58%, #06162D 100%)",
                    "&::before": {
                        content: '""',
                        position: "absolute",
                        inset: 0,
                        opacity: 0.45,
                        backgroundImage:
                            "linear-gradient(135deg, transparent 49.8%, rgba(29, 148, 206, 0.28) 50%, transparent 50.2%), linear-gradient(35deg, transparent 49.8%, rgba(29, 148, 206, 0.16) 50%, transparent 50.2%)",
                        backgroundSize: "420px 420px, 530px 530px",
                    },
                    "&::after": {
                        content: '""',
                        position: "absolute",
                        top: "-24%",
                        right: "-14%",
                        width: 520,
                        height: 520,
                        borderRadius: "50%",
                        border: "1px solid rgba(56, 189, 248, 0.12)",
                    },
                }}
            >
                <Stack
                    direction="row"
                    spacing={1.75}
                    sx={{ position: "relative", alignItems: "center" }}
                >
                    <Box
                        component="img"
                        src="/favicon.png"
                        alt="Logo Novexa"
                        sx={{
                            width: 64,
                            height: 64,
                            borderRadius: 3,
                            objectFit: "cover",
                            boxShadow:
                                "0 0 0 1px rgba(72, 230, 220, 0.18), 0 18px 36px rgba(1, 13, 31, 0.42)",
                        }}
                    />

                    <Box>
                        <Typography
                            variant="h4"
                            component="h1"
                            sx={{ color: "#F8FCFF", fontWeight: 800, letterSpacing: "0.04em" }}
                        >
                            NOVEXA
                        </Typography>
                        <Typography
                            sx={{ color: "#38BDF8", fontSize: "0.95rem", fontWeight: 700, letterSpacing: "0.12em" }}
                        >
                            ERP &amp; PDV
                        </Typography>
                    </Box>
                </Stack>

                <Stack spacing={3.25} sx={{ position: "relative", maxWidth: 520 }}>
                    <Box sx={{ width: 56, height: 3, borderRadius: 99, backgroundColor: "#38BDF8" }} />

                    <Typography
                        component="p"
                        sx={{
                            maxWidth: 480,
                            color: "#D7E5F8",
                            fontSize: { lg: "1.75rem", xl: "2.05rem" },
                            fontWeight: 400,
                            lineHeight: 1.3,
                            letterSpacing: "-0.025em",
                        }}
                    >
                        Gestão completa para o seu negócio crescer todos os dias.
                    </Typography>

                    <Stack
                        direction="row"
                        useFlexGap
                        spacing={1.25}
                        sx={{ flexWrap: "wrap" }}
                    >
                        {modulos.map((modulo) => (
                            <Chip
                                key={modulo}
                                label={modulo}
                                variant="outlined"
                                sx={{
                                    height: 32,
                                    borderColor: "rgba(148, 209, 238, 0.24)",
                                    color: "#B6CCE3",
                                    fontWeight: 600,
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                    "& .MuiChip-label": { px: 1.75 },
                                }}
                            />
                        ))}
                    </Stack>
                </Stack>

                <Stack
                    direction="row"
                    spacing={3}
                    sx={{ position: "relative", alignItems: "center", color: "#8EA7C3" }}
                >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <VerifiedUserOutlinedIcon sx={{ color: "#38BDF8", fontSize: 20 }} />
                        <Typography variant="body2">Seguro</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <CloudOutlinedIcon sx={{ color: "#38BDF8", fontSize: 20 }} />
                        <Typography variant="body2">Na nuvem</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <PointOfSaleRoundedIcon sx={{ color: "#38BDF8", fontSize: 20 }} />
                        <Typography variant="body2">Pronto para PDV</Typography>
                    </Stack>
                </Stack>
            </Box>

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "100vh",
                    px: { xs: 3, sm: 5, lg: 5, xl: 6 },
                    py: { xs: 3, sm: 4, lg: 4 },
                    background:
                        "linear-gradient(rgba(231, 238, 247, 0.42) 1px, transparent 1px), linear-gradient(90deg, rgba(231, 238, 247, 0.42) 1px, transparent 1px), #FFFFFF",
                    backgroundSize: "64px 64px",
                }}
            >
                <Paper
                    elevation={0}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        maxWidth: 420,
                        minHeight: { xs: "auto", sm: 500, lg: 515 },
                        border: { xs: 0, sm: "1px solid rgba(226, 232, 240, 0.9)" },
                        borderRadius: { xs: 0, sm: "22px" },
                        p: { xs: 0, sm: 4.5, lg: 5 },
                        backgroundColor: "#FFFFFF",
                        boxShadow: { xs: "none", sm: "0 18px 45px rgba(15, 23, 42, 0.1)" },
                    }}
                >
                    <Stack spacing={3.25} sx={{ width: "100%" }}>
                        <Stack
                            direction="row"
                            spacing={1.25}
                            sx={{ alignItems: "center", justifyContent: "center" }}
                        >
                            <Box
                                component="img"
                                src="/favicon.png"
                                alt="Logo Novexa"
                                sx={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 2,
                                    objectFit: "cover",
                                    boxShadow:
                                        "0 0 0 1px rgba(15, 199, 191, 0.16), 0 10px 22px rgba(7, 35, 62, 0.24)",
                                }}
                            />
                            <Box>
                                <Typography sx={{ color: "#0B2550", fontWeight: 800, lineHeight: 1 }}>
                                    NOVEXA
                                </Typography>
                                <Typography
                                    sx={{ color: "#1697DB", fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.1em" }}
                                >
                                    ERP &amp; PDV
                                </Typography>
                            </Box>
                        </Stack>

                        <Box>
                            <Typography
                                variant="h4"
                                component="h2"
                                sx={{
                                    color: "#101B35",
                                    fontSize: { xs: "1.65rem", sm: "1.85rem" },
                                    fontWeight: 700,
                                    lineHeight: 1.15,
                                    letterSpacing: "-0.03em",
                                }}
                            >
                                Acesso ao sistema
                            </Typography>
                            <Typography
                                sx={{ mt: 0.75, color: "#64748B", fontSize: { xs: "0.9rem", sm: "0.95rem" } }}
                            >
                                Entre para gerenciar sua operação.
                            </Typography>
                        </Box>

                        <Box component="form" noValidate onSubmit={handleLogin}>
                            <Stack spacing={2}>
                                {erroLogin && <Alert severity="error">{erroLogin}</Alert>}

                                <TextField
                                    fullWidth
                                    autoFocus
                                    autoComplete="username"
                                    placeholder="CPF"
                                    value={cpf}
                                    error={Boolean(erroCPF)}
                                    helperText={erroCPF}
                                    onChange={(evento) => {
                                        setCpf(formatarCPF(evento.target.value));
                                        setErroCPF("");
                                        setErroLogin("");
                                    }}
                                    slotProps={{
                                        htmlInput: { "aria-label": "CPF" },
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <BadgeOutlinedIcon sx={{ color: "#91A4BF" }} />
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            minHeight: 54,
                                            borderRadius: 1.75,
                                            backgroundColor: "rgba(248, 250, 252, 0.9)",
                                            "& fieldset": { borderColor: "#DCE5F0", borderWidth: 2 },
                                            "&:hover fieldset": { borderColor: "#A8D9F2" },
                                            "&.Mui-focused fieldset": { borderColor: "#1697DB" },
                                        },
                                        "& .MuiInputBase-input": {
                                            color: "#1E293B",
                                            fontSize: "0.975rem",
                                            fontWeight: 500,
                                        },
                                        "& .MuiInputBase-input::placeholder": { color: "#91A4BF", opacity: 1 },
                                    }}
                                />

                                <TextField
                                    fullWidth
                                    autoComplete="current-password"
                                    placeholder="Senha"
                                    type={mostrarSenha ? "text" : "password"}
                                    value={senha}
                                    onChange={(evento) => {
                                        setSenha(evento.target.value);
                                        setErroLogin("");
                                    }}
                                    slotProps={{
                                        htmlInput: { "aria-label": "Senha" },
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <LockOutlinedIcon sx={{ color: "#91A4BF" }} />
                                                </InputAdornment>
                                            ),
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        edge="end"
                                                        aria-label={
                                                            mostrarSenha
                                                                ? "Ocultar senha"
                                                                : "Mostrar senha"
                                                        }
                                                        onClick={() =>
                                                            setMostrarSenha((atual) => !atual)
                                                        }
                                                    >
                                                        {mostrarSenha ? (
                                                            <VisibilityOffOutlinedIcon sx={{ color: "#91A4BF" }} />
                                                        ) : (
                                                            <VisibilityOutlinedIcon sx={{ color: "#91A4BF" }} />
                                                        )}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            minHeight: 54,
                                            borderRadius: 1.75,
                                            backgroundColor: "rgba(248, 250, 252, 0.9)",
                                            "& fieldset": { borderColor: "#DCE5F0", borderWidth: 2 },
                                            "&:hover fieldset": { borderColor: "#A8D9F2" },
                                            "&.Mui-focused fieldset": { borderColor: "#1697DB" },
                                        },
                                        "& .MuiInputBase-input": {
                                            color: "#1E293B",
                                            fontSize: "0.975rem",
                                            fontWeight: 500,
                                        },
                                        "& .MuiInputBase-input::placeholder": { color: "#91A4BF", opacity: 1 },
                                    }}
                                />

                                <Button
                                    fullWidth
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    disabled={carregando}
                                    endIcon={<ArrowForwardRoundedIcon />}
                                    sx={{
                                        minHeight: 52,
                                        mt: 1,
                                        borderRadius: 1.75,
                                        fontSize: "1rem",
                                        fontWeight: 800,
                                        textTransform: "none",
                                        color: "#FFFFFF",
                                        background:
                                            "linear-gradient(100deg, #1FA6E4 0%, #0877B7 100%)",
                                        boxShadow: "0 8px 18px rgba(8, 119, 183, 0.2)",
                                        "&:hover": {
                                            background:
                                                "linear-gradient(100deg, #1597D4 0%, #07689E 100%)",
                                        },
                                    }}
                                >
                                    {carregando ? "Entrando..." : "Entrar"}
                                </Button>
                            </Stack>
                        </Box>

                        <Typography align="center" variant="body2" sx={{ color: "#94A3B8", fontSize: "0.75rem" }}>
                            Novexa ERP · Gestão para pequenos negócios
                        </Typography>
                    </Stack>
                </Paper>
            </Box>
        </Box>
    );
}

export default Login;
