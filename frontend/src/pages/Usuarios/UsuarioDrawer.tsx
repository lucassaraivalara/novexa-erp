import { useEffect, useRef, useState, type FormEvent } from "react";
import {
    Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, Drawer, FormControlLabel, IconButton, MenuItem, Stack, Switch,
    TextField, Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FormActions from "../../components/ui/FormActions";
import { mensagemUsuario, salvarUsuario } from "../../services/usuarioService";
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
        email: usuario?.email ?? "",
        perfil: usuario?.perfil ?? "USUARIO",
        ativo: usuario?.ativo !== false,
        senha: "",
    });
    const [salvando, setSalvando] = useState(false);
    const [alterado, setAlterado] = useState(false);
    const [confirmarSaida, setConfirmarSaida] = useState(false);
    const [erro, setErro] = useState("");
    const [erroNome, setErroNome] = useState(false);
    const [erroCpf, setErroCpf] = useState(false);

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
    }

    function fechar() {
        if (salvando) return;
        if (alterado) setConfirmarSaida(true);
        else onFechar();
    }

    async function enviar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (salvando) return;
        if (!form.nomeUsuario.trim()) {
            setErroNome(true);
            nomeRef.current?.focus();
            return;
        }
        const cpf = form.cpf.replace(/\D/g, "");
        if (cpf.length !== 11) {
            setErroCpf(true);
            cpfRef.current?.focus();
            return;
        }
        setSalvando(true);
        setErro("");
        try {
            const salvo = await salvarUsuario({
                ...form,
                nomeUsuario: form.nomeUsuario.trim(),
                cpf,
                email: form.email.trim(),
                senha: form.senha?.trim() || undefined,
            }, usuario?.id);
            onSalvo(salvo);
        } catch (e) {
            setErro(mensagemUsuario(e, "Não foi possível salvar o usuário. Confira os dados e tente novamente."));
        } finally {
            setSalvando(false);
        }
    }

    const titulo = usuario ? "Editar usuário" : "Novo usuário";

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
                        <Stack spacing={2}>
                            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>Dados</Typography>
                            <Divider />
                            <TextField inputRef={nomeRef} label="Nome" name="nomeUsuario" autoComplete="name" required fullWidth value={form.nomeUsuario} onChange={(e) => atualizar("nomeUsuario", e.target.value)} error={erroNome} helperText={erroNome ? "Informe o nome do usuário." : undefined} slotProps={{ htmlInput: { maxLength: 150 } }} />
                            <TextField inputRef={cpfRef} label="CPF" name="cpf" autoComplete="off" inputMode="numeric" required fullWidth value={form.cpf} onChange={(e) => atualizar("cpf", e.target.value)} error={erroCpf} helperText={erroCpf ? "Informe um CPF com 11 dígitos." : undefined} slotProps={{ htmlInput: { maxLength: 14 } }} />
                            <TextField label="E-mail" name="email" type="email" autoComplete="email" spellCheck={false} required fullWidth value={form.email} onChange={(e) => atualizar("email", e.target.value)} />
                            <TextField inputRef={senhaRef} label={usuario ? "Nova senha (opcional)" : "Senha"} name="senha" type="password" autoComplete="new-password" required={!usuario} fullWidth value={form.senha} onChange={(e) => atualizar("senha", e.target.value)} helperText={usuario ? "Deixe em branco para manter a senha atual." : undefined} />
                        </Stack>
                        <Stack spacing={2}>
                            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>Acesso</Typography>
                            <Divider />
                            <TextField select label="Perfil" name="perfil" required fullWidth value={form.perfil} onChange={(e) => atualizar("perfil", e.target.value as UsuarioInput["perfil"])}>
                                <MenuItem value="ADMIN">Administrador</MenuItem>
                                <MenuItem value="USUARIO">Usuário</MenuItem>
                            </TextField>
                            <Box sx={{ borderLeft: "3px solid", borderColor: "primary.main", pl: 2, py: 0.5 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{form.perfil === "ADMIN" ? "Administrador" : "Usuário"}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {form.perfil === "ADMIN" ? "Identifica a função administrativa." : "Identifica a função operacional."} Nesta versão, o perfil ainda não restringe telas ou ações.
                                </Typography>
                            </Box>
                            <FormControlLabel control={<Switch checked={form.ativo} onChange={(e) => atualizar("ativo", e.target.checked)} />} label="Usuário ativo" />
                        </Stack>
                    </Stack>
                    <FormActions onCancelar={fechar} tipoSalvar="submit" salvando={salvando} sx={{ mt: 0, px: 3, py: 2, bgcolor: "background.paper" }} />
                </Box>
            </Drawer>
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
