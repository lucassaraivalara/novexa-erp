import { useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import {
    Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar,
} from "@mui/material";

import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import { alterarSituacaoUsuario, listarUsuarios, mensagemUsuario } from "../../services/usuarioService";
import type { Usuario } from "../../types/usuario";
import { obterSessao } from "../../utils/auth/sessao";
import UsuarioDrawer from "./UsuarioDrawer";

export default function Usuarios() {
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [mensagem, setMensagem] = useState("");
    const [edicao, setEdicao] = useState<Usuario | null | undefined>(undefined);
    const [focarSenha, setFocarSenha] = useState(false);
    const [alterarSituacao, setAlterarSituacao] = useState<Usuario | null>(null);
    const [salvandoSituacao, setSalvandoSituacao] = useState(false);
    const usuarioLogadoId = obterSessao()?.id;

    useEffect(() => {
        const controller = new AbortController();
        listarUsuarios(controller.signal)
            .then(setUsuarios)
            .catch((e: unknown) => {
                if (!controller.signal.aborted) setErro(mensagemUsuario(e, "Não foi possível carregar os usuários."));
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, []);

    function usuarioSalvo(salvo: Usuario) {
        setUsuarios((atuais) => {
            const existe = atuais.some((usuario) => usuario.id === salvo.id);
            return existe ? atuais.map((usuario) => usuario.id === salvo.id ? salvo : usuario) : [...atuais, salvo];
        });
        setEdicao(undefined);
        setErro("");
        setMensagem("Usuário salvo com sucesso.");
    }

    async function confirmarSituacao() {
        if (!alterarSituacao || salvandoSituacao) return;
        setSalvandoSituacao(true);
        setErro("");
        try {
            const salvo = await alterarSituacaoUsuario(alterarSituacao.id, {
                ativo: alterarSituacao.ativo === false,
            });
            setUsuarios((atuais) => atuais.map((usuario) => usuario.id === salvo.id ? salvo : usuario));
            setMensagem(salvo.ativo === false ? "Usuário inativado." : "Usuário ativado.");
            setAlterarSituacao(null);
        } catch (e) {
            setErro(mensagemUsuario(e, "Não foi possível alterar a situação do usuário."));
            setAlterarSituacao(null);
        } finally {
            setSalvandoSituacao(false);
        }
    }

    const colunas: Coluna<Usuario>[] = [
        { campo: "id", cabecalho: "Código", largura: 100, ordenavel: true },
        { campo: "nomeUsuario", cabecalho: "Nome", largura: 240, ordenavel: true },
        { campo: "cpf", cabecalho: "CPF", largura: 155 },
        { campo: "email", cabecalho: "E-mail", largura: 260 },
        { campo: "perfil", cabecalho: "Perfil", largura: 135, render: (_, usuario) => usuario.perfil === "ADMIN" ? "Administrador" : usuario.perfil === "GERENTE" ? "Gerente" : "Operador" },
        { campo: "ativo", cabecalho: "Situação", largura: 120, render: (_, usuario) => <Chip size="small" variant="outlined" color={usuario.ativo === false ? "default" : "success"} label={usuario.ativo === false ? "Inativo" : "Ativo"} /> },
    ];

    const acoes: AcaoTabela<Usuario>[] = [
        { rotulo: "Editar usuário", icone: <EditOutlinedIcon fontSize="small" />, onClick: (usuario) => { setFocarSenha(false); setEdicao(usuario); } },
        { rotulo: "Redefinir senha", icone: <VpnKeyOutlinedIcon fontSize="small" />, onClick: (usuario) => { setFocarSenha(true); setEdicao(usuario); } },
        {
            rotulo: "Alterar situação",
            tooltip: "Ativar ou inativar usuário",
            icone: <PersonOffOutlinedIcon fontSize="small" />,
            onClick: (usuario) => {
                if (usuario.id === usuarioLogadoId && usuario.ativo !== false) {
                    setErro("Você não pode inativar o próprio usuário conectado.");
                    return;
                }
                setAlterarSituacao(usuario);
            },
        },
    ];

    return (
        <PageContainer>
            <PageHeader
                titulo="Usuários"
                descricao="Gerencie os usuários da empresa."
                acaoPrincipal={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { setFocarSenha(false); setEdicao(null); }}>Novo usuário</Button>}
            />

            {erro && <Alert severity="error" sx={{ mb: 2 }} aria-live="polite" onClose={() => setErro("")}>{erro}</Alert>}

            <AppTable
                colunas={colunas}
                linhas={usuarios}
                acoes={acoes}
                carregando={carregando}
                obterChaveLinha={(usuario) => usuario.id}
                vazio={{
                    titulo: "Nenhum usuário cadastrado",
                    descricao: "Cadastre um usuário para começar.",
                    icone: <PersonOutlineRoundedIcon />,
                }}
                contagem={{ total: usuarios.length }}
                minWidth={1050}
            />

            {edicao !== undefined && <UsuarioDrawer key={`${edicao?.id ?? "novo"}-${focarSenha ? "senha" : "dados"}`} usuario={edicao} focarSenha={focarSenha} onFechar={() => setEdicao(undefined)} onSalvo={usuarioSalvo} />}

            <Dialog open={alterarSituacao !== null} onClose={salvandoSituacao ? undefined : () => setAlterarSituacao(null)} aria-labelledby="situacao-usuario-titulo">
                <DialogTitle id="situacao-usuario-titulo">{alterarSituacao?.ativo === false ? "Ativar usuário?" : "Inativar usuário?"}</DialogTitle>
                <DialogContent>
                    {alterarSituacao?.ativo === false
                        ? `O acesso de ${alterarSituacao.nomeUsuario} será reativado.`
                        : `O acesso de ${alterarSituacao?.nomeUsuario ?? "este usuário"} será bloqueado.`}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAlterarSituacao(null)} disabled={salvandoSituacao}>Cancelar</Button>
                    <Button variant="contained" color={alterarSituacao?.ativo === false ? "primary" : "error"} onClick={() => void confirmarSituacao()} disabled={salvandoSituacao}>
                        {salvandoSituacao ? "Salvando…" : alterarSituacao?.ativo === false ? "Ativar" : "Inativar"}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(mensagem)} autoHideDuration={4000} onClose={() => setMensagem("")} message={mensagem} />
        </PageContainer>
    );
}
