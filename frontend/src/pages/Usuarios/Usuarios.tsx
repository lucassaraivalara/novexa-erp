import { useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import {
    Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, MenuItem, TextField,
} from "@mui/material";

import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import PageFilters from "../../components/ui/PageFilters";
import type { PaginaResponse } from "../../types/paginacao";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import { alterarSituacaoUsuario, listarUsuariosPagina, mensagemUsuario } from "../../services/usuarioService";
import type { Usuario } from "../../types/usuario";
import { obterSessao } from "../../utils/auth/sessao";
import UsuarioDrawer from "./UsuarioDrawer";

export default function Usuarios() {
    const [dados, setDados] = useState<PaginaResponse<Usuario> | null>(null);
    const [termo, setTermo] = useState("");
    const [busca, setBusca] = useState("");
    const [situacao, setSituacao] = useState("todos");
    const [pagina, setPagina] = useState(0);
    const [size, setSize] = useState(25);
    const [ordem, setOrdem] = useState<{ campo: string; direcao: "asc" | "desc" }>({ campo: "nomeUsuario", direcao: "asc" });
    const [revisao, setRevisao] = useState(0);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [mensagem, setMensagem] = useState("");
    const [edicao, setEdicao] = useState<Usuario | null | undefined>(undefined);
    const [focarSenha, setFocarSenha] = useState(false);
    const [alterarSituacao, setAlterarSituacao] = useState<Usuario | null>(null);
    const [salvandoSituacao, setSalvandoSituacao] = useState(false);
    const usuarioLogadoId = obterSessao()?.id;

    useEffect(() => {
        if (termo === busca) return;
        const timer = setTimeout(() => { setBusca(termo); setPagina(0); }, 350);
        return () => clearTimeout(timer);
    }, [termo, busca]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setCarregando(true); setErro("");
            listarUsuariosPagina({ termo: busca, ativo: situacao === "todos" ? undefined : situacao === "ativos",
                page: pagina, size, sort: `${ordem.campo},${ordem.direcao}` }, controller.signal)
                .then(resultado => {
                    if (controller.signal.aborted) return;
                    if (pagina > 0 && !resultado.items.length) { setPagina(Math.max(0, resultado.totalPages - 1)); return; }
                    setDados(resultado);
                })
                .catch((e: unknown) => {
                    if (!controller.signal.aborted) { setDados(null); setErro(mensagemUsuario(e, "Não foi possível carregar os usuários.")); }
                })
                .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        }, 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [busca, situacao, pagina, size, ordem, revisao]);

    function usuarioSalvo() {
        setRevisao(v => v + 1);
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
            setRevisao(v => v + 1);
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
        { campo: "login", cabecalho: "Login", largura: 160, ordenavel: true },
        { campo: "email", cabecalho: "E-mail", largura: 260 },
        { campo: "perfil", cabecalho: "Perfil", largura: 135, render: (_, usuario) => usuario.perfil === "ADMIN" ? "Administrador" : (usuario.perfil === "GERENTE" || usuario.perfil === "GESTOR") ? "Gestor" : "Operador" },
        { campo: "ativo", cabecalho: "Situação", largura: 120, render: (_, usuario) => <Chip size="small" variant="outlined" color={usuario.ativo === false ? "default" : "success"} label={usuario.ativo === false ? "Inativo" : "Ativo"} /> },
    ];

    const acoes: AcaoTabela<Usuario>[] = [
        { rotulo: "Editar usuário", icone: <EditOutlinedIcon fontSize="small" />, onClick: (usuario) => { setFocarSenha(false); setEdicao(usuario); } },
        { rotulo: "Redefinir senha", icone: <VpnKeyOutlinedIcon fontSize="small" />, onClick: (usuario) => { setFocarSenha(true); setEdicao(usuario); } },
        {
            rotulo: "Alterar situação",
            tooltip: "Ativar ou inativar usuário",
            icone: <PersonOffOutlinedIcon fontSize="small" />,
            desabilitado: usuario => usuario.id === usuarioLogadoId || (usuario.cpf.replace(/\D/g, "") === "02360684663" && usuario.perfil === "ADMIN"),
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
                descricao="Gerencie usuários e seus perfis de acesso."
                acaoPrincipal={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { setFocarSenha(false); setEdicao(null); }}>Novo usuário</Button>}
            />

            {erro && <Alert severity="error" sx={{ mb: 2 }} aria-live="polite" onClose={() => setErro("")}>{erro}</Alert>}

            <PageFilters busca={{ placeholder: "Buscar por nome, CPF, login ou e-mail…", valor: termo, onChange: setTermo, carregando }}>
                <TextField select size="small" label="Situação" value={situacao} onChange={e => { setSituacao(e.target.value); setPagina(0); }} sx={{ minWidth: 140 }}>
                    <MenuItem value="todos">Todos</MenuItem><MenuItem value="ativos">Ativos</MenuItem><MenuItem value="inativos">Inativos</MenuItem>
                </TextField>
            </PageFilters>
            {erro && <Button onClick={() => setRevisao(v => v + 1)}>Tentar novamente</Button>}
            {!erro && <AppTable
                colunas={colunas}
                linhas={dados?.items ?? []}
                acoes={acoes}
                carregando={carregando}
                obterChaveLinha={(usuario) => usuario.id}
                vazio={{
                    titulo: "Nenhum usuário encontrado",
                    descricao: "Revise os filtros ou cadastre um usuário.",
                    icone: <PersonOutlineRoundedIcon />,
                }}
                ordenacaoRemota ordenacao={{ ...ordem, onSort: campo => { setOrdem({ campo, direcao: ordem.campo === campo && ordem.direcao === "asc" ? "desc" : "asc" }); setPagina(0); } }}
                paginacao={{ pagina, linhasPorPagina: size, total: dados?.totalItems ?? 0, onPageChange: setPagina,
                    onRowsPerPageChange: valor => { setSize(valor); setPagina(0); }, opcoesLinhasPorPagina: [10, 25, 50] }}
                minWidth={1050}
            />}

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
