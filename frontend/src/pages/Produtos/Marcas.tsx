import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogContentText,
    DialogTitle, FormControlLabel, MenuItem, Stack, TextField } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import PageFilters from "../../components/ui/PageFilters";
import AppTable, { type Coluna } from "../../components/ui/AppTable";
import CadastroDialog from "../../components/ui/CadastroDialog";
import { listarMarcas, salvarMarca, excluirMarca, mensagemMarca } from "../../services/marcaService";
import type { Marca } from "../../types/marca";
import type { PaginaResponse } from "../../types/paginacao";

function MarcaForm({ registro, onFechar, onSalvo }: { registro: Marca | null; onFechar: () => void; onSalvo: () => void }) {
    const [nome, setNome] = useState(registro?.nome ?? "");
    const [ativo, setAtivo] = useState(registro?.ativo ?? true);
    const [erro, setErro] = useState("");
    const [salvando, setSalvando] = useState(false);
    async function salvar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (salvando) return;
        if (!nome.trim() || nome.length > 100) { setErro("Informe um nome de até 100 caracteres."); return; }
        setSalvando(true); setErro("");
        try { await salvarMarca(registro?.id ?? null, { nome: nome.trim(), ativo }); onSalvo(); }
        catch (e) { setErro(mensagemMarca(e, "Não foi possível salvar a marca.")); }
        finally { setSalvando(false); }
    }
    return <CadastroDialog aberto variante="compact" titulo={registro ? "Editar marca" : "Nova marca"}
        descricao="Mantenha o nome e a situação da marca da empresa." salvando={salvando} onFechar={onFechar} onSubmit={salvar}>
        <Stack spacing={2}>
            {erro && <Alert severity="error">{erro}</Alert>}
            <TextField label="Nome" value={nome} onChange={e => setNome(e.target.value)} autoFocus fullWidth required
                disabled={salvando} slotProps={{ htmlInput: { maxLength: 100 } }} />
            <FormControlLabel control={<Checkbox checked={ativo} disabled={salvando} onChange={e => setAtivo(e.target.checked)} />} label="Ativa" />
        </Stack>
    </CadastroDialog>;
}

export default function Marcas() {
    const [termo, setTermo] = useState("");
    const [busca, setBusca] = useState("");
    const [situacao, setSituacao] = useState("ativas");
    const [pagina, setPagina] = useState(0);
    const [size, setSize] = useState(25);
    const [ordem, setOrdem] = useState<{ campo: string; direcao: "asc" | "desc" }>({ campo: "nome", direcao: "asc" });
    const [dados, setDados] = useState<PaginaResponse<Marca> | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [aviso, setAviso] = useState("");
    const [revisao, setRevisao] = useState(0);
    const [form, setForm] = useState<{ registro: Marca | null } | null>(null);
    const [exclusao, setExclusao] = useState<Marca | null>(null);
    const [excluindo, setExcluindo] = useState(false);
    const [erroExclusao, setErroExclusao] = useState("");
    useEffect(() => {
        if (termo === busca) return;
        const timer = setTimeout(() => { setBusca(termo); setPagina(0); }, 350);
        return () => clearTimeout(timer);
    }, [termo, busca]);
    useEffect(() => {
        const controle = new AbortController();
        const timer = setTimeout(() => {
            setCarregando(true); setErro("");
            listarMarcas({ termo: busca, ativo: situacao === "todas" ? undefined : situacao === "ativas",
                page: pagina, size, sort: `${ordem.campo},${ordem.direcao}` }, controle.signal).then(resultado => {
                if (controle.signal.aborted) return;
                if (pagina > 0 && resultado.items.length === 0) { setPagina(Math.max(0, resultado.totalPages - 1)); return; }
                setDados(resultado);
            }).catch(e => { if (!controle.signal.aborted) { setDados(null); setErro(mensagemMarca(e, "Não foi possível carregar as marcas.")); } })
                .finally(() => { if (!controle.signal.aborted) setCarregando(false); });
        }, 0);
        return () => { clearTimeout(timer); controle.abort(); };
    }, [busca, situacao, pagina, size, ordem, revisao]);
    const colunas: Coluna<Marca>[] = [
        { campo: "nome", cabecalho: "Nome", ordenavel: true },
        { campo: "ativo", cabecalho: "Situação", ordenavel: true, render: (_, linha) => <Chip size="small" label={linha.ativo ? "Ativa" : "Inativa"} color={linha.ativo ? "success" : "default"} variant="outlined" /> },
    ];
    async function excluir() {
        if (!exclusao || excluindo) return;
        setExcluindo(true); setErroExclusao("");
        try { await excluirMarca(exclusao.id); setExclusao(null); setAviso("Marca excluída."); setRevisao(v => v + 1); }
        catch (e) { setErroExclusao(mensagemMarca(e, "Não foi possível excluir a marca.")); }
        finally { setExcluindo(false); }
    }
    return <PageContainer>
        <PageHeader titulo="Marcas" descricao="Cadastre e mantenha as marcas da empresa."
            acaoPrincipal={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setForm({ registro: null })}>Nova marca</Button>} />
        {aviso && <Alert severity="success" onClose={() => setAviso("")}>{aviso}</Alert>}
        <PageFilters busca={{ placeholder: "Buscar por nome…", valor: termo, onChange: setTermo, carregando }}>
            <TextField select size="small" label="Situação" value={situacao} onChange={e => { setSituacao(e.target.value); setPagina(0); }} sx={{ minWidth: 140 }}>
                <MenuItem value="ativas">Ativas</MenuItem><MenuItem value="inativas">Inativas</MenuItem><MenuItem value="todas">Todas</MenuItem>
            </TextField>
        </PageFilters>
        {erro ? <Alert severity="error" action={<Button color="inherit" onClick={() => setRevisao(v => v + 1)}>Tentar novamente</Button>}>{erro}</Alert>
            : <AppTable colunas={colunas} linhas={dados?.items ?? []} obterChaveLinha={linha => linha.id} carregando={carregando} minWidth={380}
                vazio={{ titulo: "Nenhuma marca encontrada", descricao: "Revise os filtros ou cadastre uma marca." }}
                acoes={[
                    { rotulo: "Editar", icone: <EditRoundedIcon />, onClick: registro => setForm({ registro }), desabilitado: () => carregando },
                    { rotulo: "Excluir", icone: <DeleteOutlineRoundedIcon />, cor: "error", onClick: registro => { setErroExclusao(""); setExclusao(registro); }, desabilitado: () => carregando },
                ]}
                ordenacaoRemota ordenacao={{ ...ordem, onSort: campo => { setOrdem({ campo, direcao: ordem.campo === campo && ordem.direcao === "asc" ? "desc" : "asc" }); setPagina(0); } }}
                paginacao={{ pagina, linhasPorPagina: size, total: dados?.totalItems ?? 0, onPageChange: setPagina,
                    onRowsPerPageChange: valor => { setSize(valor); setPagina(0); }, opcoesLinhasPorPagina: [10, 25, 50] }} />}
        {form && <MarcaForm registro={form.registro} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); setAviso("Marca salva."); setRevisao(v => v + 1); }} />}
        <Dialog open={Boolean(exclusao)} onClose={excluindo ? undefined : () => setExclusao(null)} aria-labelledby="excluir-marca-titulo">
            <DialogTitle id="excluir-marca-titulo">Excluir marca?</DialogTitle>
            <DialogContent><DialogContentText>Excluir “{exclusao?.nome}” é definitivo. Para manter o cadastro, edite e desmarque Ativa.</DialogContentText>
                <DialogContentText sx={{ mt: 1 }}>Marcas com produtos vinculados não podem ser excluídas, mesmo se os produtos estiverem inativos.</DialogContentText>
                {erroExclusao && <Alert severity="error" sx={{ mt: 2 }}>{erroExclusao}</Alert>}
            </DialogContent>
            <DialogActions><Button disabled={excluindo} onClick={() => setExclusao(null)}>Voltar</Button><Button color="error" disabled={excluindo} onClick={excluir}>{excluindo ? "Excluindo…" : "Excluir"}</Button></DialogActions>
        </Dialog>
    </PageContainer>;
}
