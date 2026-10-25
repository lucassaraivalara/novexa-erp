import CampoTexto from "../../components/ui/CampoTexto";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
    Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, Drawer, FormControlLabel, IconButton, InputAdornment, MenuItem, Stack, Switch,
    Typography,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { obterSessao } from "../../utils/auth/sessao";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FormActions from "../../components/ui/FormActions";
import { mensagemUsuario, redefinirSenhaUsuario, salvarUsuario } from "../../services/usuarioService";
import type { Usuario, UsuarioInput } from "../../types/usuario";

type Props = {
    usuario: Usuario | null;
    focarSenha?: boolean;
    onFechar: () => void;
    onSalvo: (usuario: Usuario) => void;
};

export default function UsuarioDrawer({ usuario, focarSenha = false, onFechar, onSalvo }: Props) {
    const nomeRef = useRef<HTMLInputElement>(null);
    const cpfRef = useRef<HTMLInputElement>(null);
    const senhaRef = useRef<HTMLInputElement>(null);
    const [form, setForm] = useState<UsuarioInput>({
        nomeUsuario: usuario?.nomeUsuario ?? "",
        cpf: usuario?.cpf ?? "",
        login: usuario?.login ?? usuario?.cpf ?? "",
        email: usuario?.email ?? "",
        perfil: usuario?.perfil === "USUARIO" ? "OPERADOR" : usuario?.perfil === "GERENTE" ? "GESTOR" : usuario?.perfil ?? "OPERADOR",
        ativo: usuario?.ativo !== false,
        senha: "",
    });
    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [confirmarInativacao, setConfirmarInativacao] = useState(false);
    const proprio = usuario?.id === obterSessao()?.id;
    const preservado = usuario?.cpf.replace(/\D/g, "") === "02360684663" && usuario?.perfil === "ADMIN";
    const [salvando, setSalvando] = useState(false);
    const [alterado, setAlterado] = useState(false);
    const [confirmarSaida, setConfirmarSaida] = useState(false);
    const [erro, setErro] = useState("");
    const [erroNome, setErroNome] = useState(false);
    const [erroCpf, setErroCpf] = useState(false);
    const [erroSenha, setErroSenha] = useState(false);

    const redefinindoSenha = Boolean(usuario && focarSenha);
    const exibirSenha = !usuario || redefinindoSenha;

    useEffect(() => {
        if (!focarSenha || !window.matchMedia("(min-width: 600px)").matches) return;
        const frame = requestAnimationFrame(() => senhaRef.current?.focus());
        return () => cancelAnimationFrame(frame);
    }, [focarSenha]);

    function atualizar<K extends keyof UsuarioInput>(campo: K, valor: UsuarioInput[K]) {
        setForm((atual) => ({ ...atual, [campo]: valor }));
        setAlterado(true);
        setErro("");
        if (campo === "nomeUsuario") setErroNome(false);
        if (campo === "cpf") setErroCpf(false);
        if (campo === "senha") setErroSenha(false);
    }

    function fechar() {
        if (salvando) return;
        if (alterado) setConfirmarSaida(true);
        else onFechar();
    }

    async function enviar(evento?: FormEvent<HTMLFormElement>, confirmado = false) {
        evento?.preventDefault();
        if (salvando) return;
        if (!redefinindoSenha && !form.nomeUsuario.trim()) {
            setErroNome(true);
            nomeRef.current?.focus();
            return;
        }
        const cpf = form.cpf.replace(/\D/g, "");
        if (!redefinindoSenha && cpf.length !== 11) {
            setErroCpf(true);
            cpfRef.current?.focus();
            return;
        }
        if (exibirSenha && !form.senha?.trim()) {
            setErroSenha(true);
            senhaRef.current?.focus();
            return;
        }
        if (!redefinindoSenha && usuario && usuario.ativo !== false && !form.ativo && !confirmado) { setConfirmarInativacao(true); return; }
        setConfirmarInativacao(false);
        setSalvando(true);
        setErro("");
        try {
            const salvo = redefinindoSenha
                ? await redefinirSenhaUsuario(usuario!.id, { senha: form.senha! })
                : await salvarUsuario({
                    ...form,
                    nomeUsuario: form.nomeUsuario.trim(),
                    cpf,
                    email: form.email.trim(),
                    login: form.login.trim(),
                    senha: usuario ? undefined : form.senha,
                }, usuario?.id);
            onSalvo(salvo);
        } catch (e) {
            setErro(mensagemUsuario(e, "Não foi possível salvar o usuário. Confira os dados e tente novamente."));
        } finally {
            setSalvando(false);
        }
    }

    const titulo = redefinindoSenha ? "Redefinir senha" : usuario ? "Editar usuário" : "Novo usuário";

    return (
        <>
            <Drawer
                anchor="right"
                open
                onClose={fechar}
                slotProps={{ paper: { "aria-labelledby": "usuario-drawer-titulo", sx: { width: { xs: "100%", sm: 520 }, maxWidth: "100vw", overscrollBehavior: "contain" } } }}
            >
                <Box component="form" onSubmit={(evento) => void enviar(evento)} sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
                    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography id="usuario-drawer-titulo" component="h2" variant="h6" sx={{ fontWeight: 700 }}>{titulo}</Typography>
                        <IconButton onClick={fechar} disabled={salvando} aria-label="Fechar cadastro de usuário" sx={{ "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main" } }}>
                            <CloseRoundedIcon />
                        </IconButton>
                    </Stack>
                    <Stack spacing={3} sx={{ px: 3, py: 3, flex: 1, overflowY: "auto", overscrollBehavior: "contain" }}>
                        {erro && <Alert severity="error" aria-live="polite">{erro}</Alert>}
                        {!redefinindoSenha && <Stack spacing={2}>
                            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>Dados</Typography>
                            <Divider />
                            <CampoTexto placeholder="Digite o nome do usuário…" inputRef={nomeRef} label="Nome" name="nomeUsuario" autoComplete="name" required fullWidth value={form.nomeUsuario} onChange={(e) => atualizar("nomeUsuario", e.target.value)} error={erroNome} helperText={erroNome ? "Informe o nome do usuário." : undefined} slotProps={{ htmlInput: { maxLength: 150 } }} />
                            <CampoTexto placeholder="Digite o CPF…" inputRef={cpfRef} label="CPF" name="cpf" disabled={preservado} autoComplete="off" inputMode="numeric" required fullWidth value={form.cpf} onChange={(e) => atualizar("cpf", e.target.value)} error={erroCpf} helperText={erroCpf ? "Informe um CPF com 11 dígitos." : undefined} slotProps={{ htmlInput: { maxLength: 14 } }} />
                            <CampoTexto placeholder="Identificação interna do usuário…" label="Login" name="login" required fullWidth autoComplete="off" value={form.login} onChange={(e) => atualizar("login", e.target.value)} helperText="Identificação interna. O acesso continua sendo feito pelo CPF." slotProps={{ htmlInput: { maxLength: 255 } }} />
                            <CampoTexto placeholder="Ex.: pessoa@empresa.com.br…" label="E-mail" name="email" type="email" autoComplete="email" spellCheck={false} required fullWidth value={form.email} onChange={(e) => atualizar("email", e.target.value)} />
                            {!usuario && <CampoTexto placeholder="Digite a senha inicial…" inputRef={senhaRef} label="Senha" name="senha" type={mostrarSenha ? "text" : "password"} slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"} onClick={() => setMostrarSenha(v => !v)} edge="end">{mostrarSenha ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment> } }} autoComplete="new-password" required fullWidth value={form.senha} onChange={(e) => atualizar("senha", e.target.value)} error={erroSenha} helperText={erroSenha ? "Informe a senha." : undefined} />}
                        </Stack>}
                        {redefinindoSenha && <Stack spacing={2}>
                            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>Nova senha</Typography>
                            <Divider />
                            <CampoTexto placeholder="Digite a nova senha…" inputRef={senhaRef} label="Nova senha" name="senha" type={mostrarSenha ? "text" : "password"} slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"} onClick={() => setMostrarSenha(v => !v)} edge="end">{mostrarSenha ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment> } }} autoComplete="new-password" required fullWidth value={form.senha} onChange={(e) => atualizar("senha", e.target.value)} error={erroSenha} helperText={erroSenha ? "Informe a nova senha." : "As sessões anteriores serão encerradas. Entre novamente com a nova senha."} />
                        </Stack>}
                        {!redefinindoSenha && <Stack spacing={2}>
                            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>Acesso</Typography>
                            <Divider />
                            <CampoTexto select disabled={preservado} label="Perfil" name="perfil" required fullWidth value={form.perfil} onChange={(e) => atualizar("perfil", e.target.value as UsuarioInput["perfil"])}>
                                <MenuItem value="ADMIN">Administrador</MenuItem>
                                <MenuItem value="GESTOR">Gestor</MenuItem>
                                <MenuItem value="OPERADOR">Operador</MenuItem>
                            </CampoTexto>
                            <Box sx={{ borderLeft: "3px solid", borderColor: "primary.main", pl: 2, py: 0.5 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {form.perfil === "ADMIN" ? "Administrador" : form.perfil === "GESTOR" ? "Gestor" : "Operador"}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {form.perfil === "ADMIN"
                                        ? "Gerencia usuários e pode cancelar vendas, movimentar e fechar caixas."
                                        : form.perfil === "GESTOR"
                                            ? "Pode cancelar vendas, registrar sangrias e suprimentos e fechar caixas."
                                            : "Pode vender, abrir caixa e fechar a própria sessão. Ações gerenciais exigem outro perfil."}
                                </Typography>
                            </Box>
                            <FormControlLabel control={<Switch disabled={proprio || preservado} checked={form.ativo} onChange={(e) => atualizar("ativo", e.target.checked)} />} label="Usuário ativo" />
                        </Stack>}
                    </Stack>
                    <FormActions onCancelar={fechar} tipoSalvar="submit" salvando={salvando} sx={{ mt: 0, px: 3, py: 2, bgcolor: "background.paper" }} />
                </Box>
            </Drawer>
            <Dialog open={confirmarInativacao} onClose={() => setConfirmarInativacao(false)} aria-labelledby="inativar-edicao-titulo">
                <DialogTitle id="inativar-edicao-titulo">Inativar usuário?</DialogTitle>
                <DialogContent>O acesso será bloqueado e as sessões anteriores serão encerradas.</DialogContent>
                <DialogActions><Button onClick={() => setConfirmarInativacao(false)}>Voltar</Button><Button color="error" onClick={() => void enviar(undefined, true)}>Inativar e salvar</Button></DialogActions>
            </Dialog>
            <Dialog open={confirmarSaida} onClose={() => setConfirmarSaida(false)} aria-labelledby="descartar-usuario-titulo">
                <DialogTitle id="descartar-usuario-titulo">Descartar alterações?</DialogTitle>
                <DialogContent>Os dados preenchidos serão perdidos.</DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmarSaida(false)}>Continuar editando</Button>
                    <Button color="error" onClick={onFechar}>Descartar</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
