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
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { Alert, Box, Button, Checkbox, Chip, FormControlLabel, IconButton, InputAdornment, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { realizarLogin } from "../../services/authService";
import { salvarSessao } from "../../utils/auth/sessao";
import { formatarCPF } from "../../utils/masks/cpfMask";
import { validarCPF } from "../../utils/validators/cpfValidator";
import "./Login.css";

const modulos = [
    { nome: "Vendas", Icone: TrendingUpRoundedIcon },
    { nome: "Estoque", Icone: Inventory2OutlinedIcon },
    { nome: "Clientes", Icone: PeopleOutlineIcon },
    { nome: "Compras", Icone: ShoppingBagOutlinedIcon },
    { nome: "Financeiro", Icone: AccountBalanceWalletOutlinedIcon },
    { nome: "PDV", Icone: PointOfSaleRoundedIcon },
];

function Marca({ institucional = false }: { institucional?: boolean }) {
    return (
        <div className={`login-brand ${institucional ? "login-brand-institutional" : ""}`}>
            <span className="login-symbol" role="img" aria-label="Símbolo N Novexa" />
            <div><strong>NOVEXA</strong><span>ERP &amp; PDV</span></div>
        </div>
    );
}

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
        if (carregando) return;
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
            const dados = await realizarLogin({ cpf: cpf.replace(/\D/g, ""), senha });
            salvarSessao({
                id: dados.id,
                nomeUsuario: dados.nomeUsuario,
                cpf: dados.cpf,
                email: dados.email,
                perfil: dados.perfil,
                empresa: dados.empresa,
                token: dados.token,
                autenticadoEm: new Date().toISOString(),
            });
            navigate("/dashboard", { replace: true });
        } catch (erro) {
            const mensagem = erro instanceof Error ? erro.message : "Não foi possível entrar.";
            setErroLogin(mensagem);
        } finally {
            setCarregando(false);
        }
    }

    return (
        <Box className="login-page">
            <Box component="aside" className="login-institutional" aria-label="Novexa ERP e PDV">
                <Marca institucional />
                <div className="login-presentation">
                    <span className="login-platform"><span />Plataforma de gestão</span>
                    <Typography component="h1" className="login-headline">
                        Gestão completa<br />para o seu negócio<br />
                        <span>crescer todos os dias.</span>
                    </Typography>
                    <Typography className="login-description">
                        Vendas, estoque, financeiro e PDV integrados em uma única plataforma, simples de usar no dia a dia.
                    </Typography>
                    <div className="login-product-preview" aria-label="Exemplo ilustrativo de resumo do produto">
                        <div className="login-revenue-heading"><span>Faturamento hoje</span><span className="login-growth"><TrendingUpRoundedIcon />+12%</span></div>
                        <strong className="login-revenue">R$ 4.280,00</strong>
                        <div className="login-chart" aria-hidden="true">
                            <span /><span /><span /><span /><span /><span /><span /><span />
                        </div>
                        <div className="login-preview-footer"><span>Vendas <strong>38</strong></span><span>Ticket médio <strong>R$ 112,60</strong></span></div>
                    </div>
                    <Stack direction="row" useFlexGap spacing={1} className="login-modules">
                        {modulos.map(({ nome, Icone }) => <Chip key={nome} label={nome} icon={<Icone />} variant="outlined" />)}
                    </Stack>
                </div>
                <div className="login-trust">
                    <span><VerifiedUserOutlinedIcon />Seguro</span>
                    <span><CloudOutlinedIcon />Na nuvem</span>
                    <span><PointOfSaleRoundedIcon />Pronto para PDV</span>
                </div>
            </Box>
            <Box component="main" className="login-access">
                <Paper elevation={0} className="login-card">
                    <Marca />
                    <div className="login-welcome">
                        <Typography component="h2">Acesso ao sistema</Typography>
                        <Typography color="text.secondary">Entre para gerenciar sua operação.</Typography>
                    </div>
                    <Box component="form" onSubmit={handleLogin} noValidate>
                        <Stack spacing={2.5}>
                            {erroLogin && <Alert severity="error">{erroLogin}</Alert>}
                            <div>
                                <label className="login-label" htmlFor="login-cpf">CPF</label>
                                <TextField
                                    id="login-cpf" fullWidth autoFocus autoComplete="username" placeholder="000.000.000-00"
                                    value={cpf} error={Boolean(erroCPF)} helperText={erroCPF}
                                    onChange={(evento) => { setCpf(formatarCPF(evento.target.value)); setErroCPF(""); setErroLogin(""); }}
                                    slotProps={{
                                        htmlInput: { "aria-label": "CPF", inputMode: "numeric" },
                                        input: { startAdornment: <InputAdornment position="start"><BadgeOutlinedIcon /></InputAdornment> },
                                    }}
                                />
                            </div>
                            <div>
                                <div className="login-label-row">
                                    <label className="login-label" htmlFor="login-password">Senha</label>
                                    <Tooltip title="Recuperação de senha ainda não disponível.">
                                        <span><Button className="login-text-link" disabled>Esqueci minha senha</Button></span>
                                    </Tooltip>
                                </div>
                                <TextField
                                    id="login-password" fullWidth autoComplete="current-password" placeholder="Digite sua senha"
                                    type={mostrarSenha ? "text" : "password"} value={senha}
                                    onChange={(evento) => { setSenha(evento.target.value); setErroLogin(""); }}
                                    slotProps={{
                                        htmlInput: { "aria-label": "Senha" },
                                        input: {
                                            startAdornment: <InputAdornment position="start"><LockOutlinedIcon /></InputAdornment>,
                                            endAdornment: <InputAdornment position="end">
                                                <IconButton edge="end" aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                                                    onClick={() => setMostrarSenha((atual) => !atual)}>
                                                    {mostrarSenha ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                                                </IconButton>
                                            </InputAdornment>,
                                        },
                                    }}
                                />
                            </div>
                            <Tooltip title="A sessão atual já permanece conectada neste navegador.">
                                <span><FormControlLabel className="login-remember" control={<Checkbox checked disabled size="small" />} label="Manter conectado" /></span>
                            </Tooltip>
                            <Button fullWidth type="submit" variant="contained" disabled={carregando} endIcon={<ArrowForwardRoundedIcon />} className="login-submit">
                                {carregando ? "Entrando..." : "Acessar"}
                            </Button>
                        </Stack>
                    </Box>
                    <div className="login-card-footer">
                        <Typography variant="caption">Novexa ERP · Gestão para pequenos negócios</Typography>
                        <Typography variant="caption">Precisa de ajuda?{" "}
                            <Tooltip title="Canal de suporte ainda não configurado.">
                                <span><Button className="login-text-link" disabled>Fale com o suporte</Button></span>
                            </Tooltip>
                        </Typography>
                    </div>
                </Paper>
            </Box>
        </Box>
    );
}

export default Login;
