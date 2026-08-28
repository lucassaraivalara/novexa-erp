import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
    Alert,
    Box,
    Button,
    IconButton,
    InputAdornment,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { formatarCPF } from "../../utils/masks/cpfMask";
import { salvarSessao } from "../../utils/auth/sessao";
import { validarCPF } from "../../utils/validators/cpfValidator";

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
            // A variável permite trocar a API em outro ambiente.
            // Localmente, o backend Spring Boot usa a porta 8080.
            const apiBase =
                (import.meta.env.VITE_API_URL as string | undefined) ??
                "http://localhost:8080";

            const resposta = await fetch(
                `${apiBase.replace(/\/$/, "")}/auth/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        cpf: cpf.replace(/\D/g, ""),
                        senha,
                    }),
                }
            );

            if (!resposta.ok) {
                const mensagem = await resposta.text();
                throw new Error(mensagem || "CPF ou senha inválidos.");
            }

            const dados = await resposta.json();

            salvarSessao({
                id: dados.id,
                nomeUsuario: dados.nomeUsuario,
                cpf: dados.cpf,
                email: dados.email,
                autenticadoEm: new Date().toISOString(),
            });

            navigate("/inicio", { replace: true });
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
                gridTemplateColumns: {
                    xs: "1fr",
                    md: "minmax(360px, 0.95fr) minmax(420px, 1.05fr)",
                },
                backgroundColor: "background.default",
            }}
        >
            <Box
                sx={{
                    display: { xs: "none", md: "flex" },
                    flexDirection: "column",
                    justifyContent: "space-between",
                    position: "relative",
                    overflow: "hidden",
                    p: { md: 5, lg: 7 },
                    color: "common.white",
                    background: (theme) =>
                        `linear-gradient(145deg, ${theme.palette.secondary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                }}
            >
                <Box
                    sx={{
                        position: "absolute",
                        top: -160,
                        right: -120,
                        width: 360,
                        height: 360,
                        borderRadius: "50%",
                        backgroundColor: "rgba(255, 255, 255, 0.07)",
                    }}
                />

                <Stack spacing={3} sx={{ position: "relative", maxWidth: 420 }}>
                    <Box
                        sx={{
                            display: "grid",
                            width: 64,
                            height: 64,
                            placeItems: "center",
                            borderRadius: 3,
                            backgroundColor: "rgba(255, 255, 255, 0.14)",
                        }}
                    >
                        <HubRoundedIcon fontSize="large" />
                    </Box>

                    <Box>
                        <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
                            NOVEXA
                        </Typography>
                        <Typography sx={{ mt: 0.5, opacity: 0.78 }}>
                            ERP conectado à sua operação.
                        </Typography>
                    </Box>
                </Stack>

                <Typography variant="body2" sx={{ position: "relative", opacity: 0.72 }}>
                    Gestão simples, organizada e preparada para crescer.
                </Typography>
            </Box>

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: { xs: 3, sm: 5, md: 7 },
                }}
            >
                <Box sx={{ width: "100%", maxWidth: 440 }}>
                    <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{
                            display: { xs: "flex", md: "none" },
                            alignItems: "center",
                            mb: 5,
                        }}
                    >
                        <Box
                            sx={{
                                display: "grid",
                                width: 48,
                                height: 48,
                                placeItems: "center",
                                borderRadius: 2.5,
                                color: "primary.contrastText",
                                backgroundColor: "primary.main",
                            }}
                        >
                            <HubRoundedIcon />
                        </Box>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                NOVEXA
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                ERP
                            </Typography>
                        </Box>
                    </Stack>

                    <Typography variant="h4" component="h2" sx={{ fontWeight: 700 }}>
                        Acesse sua conta
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                        Informe suas credenciais para continuar.
                    </Typography>

                    <Paper
                        variant="outlined"
                        sx={{
                            mt: 4,
                            p: { xs: 2.5, sm: 4 },
                            borderColor: "divider",
                            boxShadow: "0 24px 48px rgba(16, 42, 67, 0.08)",
                        }}
                    >
                        <Box component="form" noValidate onSubmit={handleLogin}>
                            <Stack spacing={2.5}>
                                {erroLogin && <Alert severity="error">{erroLogin}</Alert>}

                                <TextField
                                    fullWidth
                                    autoFocus
                                    autoComplete="username"
                                    label="CPF"
                                    placeholder="000.000.000-00"
                                    value={cpf}
                                    error={Boolean(erroCPF)}
                                    helperText={erroCPF}
                                    onChange={(evento) => {
                                        setCpf(formatarCPF(evento.target.value));
                                        setErroCPF("");
                                        setErroLogin("");
                                    }}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <BadgeOutlinedIcon color="action" />
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                />

                                <TextField
                                    fullWidth
                                    autoComplete="current-password"
                                    label="Senha"
                                    type={mostrarSenha ? "text" : "password"}
                                    value={senha}
                                    onChange={(evento) => {
                                        setSenha(evento.target.value);
                                        setErroLogin("");
                                    }}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <LockOutlinedIcon color="action" />
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
                                                            <VisibilityOffOutlinedIcon />
                                                        ) : (
                                                            <VisibilityOutlinedIcon />
                                                        )}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                />

                                <Button
                                    fullWidth
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    disabled={carregando}
                                    startIcon={<LoginRoundedIcon />}
                                    sx={{
                                        minHeight: 48,
                                        fontWeight: 700,
                                        textTransform: "none",
                                    }}
                                >
                                    {carregando ? "Entrando..." : "Entrar"}
                                </Button>
                            </Stack>
                        </Box>
                    </Paper>
                </Box>
            </Box>
        </Box>
    );
}

export default Login;
