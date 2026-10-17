import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Autocomplete, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogContentText, DialogTitle, FormControlLabel, MenuItem, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import PageFilters from "../../components/ui/PageFilters";
import AppTable, { type Coluna } from "../../components/ui/AppTable";
import CadastroDialog from "../../components/ui/CadastroDialog";
import { useRemoteSearch } from "../../hooks/useRemoteSearch";
import { listarCategorias, listarSubcategorias, salvarCategoria, salvarSubcategoria,
    excluirCategoria, excluirSubcategoria, mensagemCategoria } from "../../services/categoriaProdutoService";
import type { CategoriaProduto, SubcategoriaProduto } from "../../types/categoriaProduto";
import type { PaginaResponse } from "../../types/paginacao";

function SeletorCategoria({ value, onChange, disabled = false }: {
    value: CategoriaProduto | null; onChange: (valor: CategoriaProduto | null) => void; disabled?: boolean;
}) {
    const [opcoes, setOpcoes] = useState<CategoriaProduto[]>([]);
    const [erro, setErro] = useState("");
    const busca = useRemoteSearch({ minLength: 0,
        search: async (termo, signal) => (await listarCategorias({ termo, page: 0, size: 25 }, signal)).items,
        onResults: (itens) => { setOpcoes(itens); setErro(""); },
        onError: (e) => { setOpcoes([]); setErro(mensagemCategoria(e, "Não foi possível consultar categorias.")); },
    });
    const disponiveis = value && !opcoes.some(o => o.id === value.id) ? [value, ...opcoes] : opcoes;
    return <Stack spacing={1} sx={{ minWidth: 0, width: "100%" }}>
        <Autocomplete value={value} options={disponiveis} disabled={disabled} loading={busca.loading}
            onChange={(_, item) => onChange(item)} isOptionEqualToValue={(a, b) => a.id === b.id}
            getOptionLabel={item => `${item.nome}${item.ativo ? "" : " (inativa)"}`} filterOptions={items => items}
            onInputChange={(_, texto, motivo) => { if (motivo === "input" || motivo === "clear") busca.setTerm(texto); }}
            noOptionsText={erro ? "Consulta indisponível" : "Nenhuma categoria encontrada"}
            renderInput={params => <TextField {...params} label="Categoria" size="small"
                helperText="Pesquise pelo nome. Até 25 opções por consulta." error={Boolean(erro)}
                slotProps={{ ...params.slotProps, input: { ...params.slotProps.input, endAdornment: <>{busca.loading && <CircularProgress size={16} />}{params.slotProps.input.endAdornment}</> } }} />} />
        {erro && <Alert severity="error" action={<Button color="inherit" onClick={busca.refresh}>Tentar novamente</Button>}>{erro}</Alert>}
    </Stack>;
}

function Cadastro({ sub, registro, onFechar, onSalvo }: {
    sub: boolean; registro: CategoriaProduto | SubcategoriaProduto | null; onFechar: () => void; onSalvo: () => void;
}) {
    const [nome, setNome] = useState(registro?.nome ?? "");
    const [ativo, setAtivo] = useState(registro?.ativo ?? true);
    const [categoria, setCategoria] = useState<CategoriaProduto | null>(registro && "categoria" in registro ? registro.categoria : null);
    const [erro, setErro] = useState("");
    const [salvando, setSalvando] = useState(false);
    async function salvar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (salvando) return;
        if (!nome.trim() || nome.length > 100 || (sub && !categoria)) {
            setErro(sub ? "Informe um nome de até 100 caracteres e selecione a categoria." : "Informe um nome de até 100 caracteres."); return;
        }
        setSalvando(true); setErro("");
        try {
            const dados = { nome: nome.trim(), ativo };
            if (sub && categoria) await salvarSubcategoria(registro?.id ?? null, { ...dados, categoriaId: categoria.id });
            else await salvarCategoria(registro?.id ?? null, dados);
            onSalvo();
        } catch (e) { setErro(mensagemCategoria(e, "Não foi possível salvar o cadastro.")); }
        finally { setSalvando(false); }
    }
    return <CadastroDialog aberto variante="compact" titulo={`${registro ? "Editar" : "Nova"} ${sub ? "subcategoria" : "categoria"}`}
        descricao={sub ? "Vincule a subcategoria a uma categoria da empresa." : "Mantenha as categorias da empresa."}
        salvando={salvando} onFechar={onFechar} onSubmit={salvar}>
        <Stack spacing={2}>
            {erro && <Alert severity="error">{erro}</Alert>}
            <TextField label="Nome" value={nome} onChange={e => setNome(e.target.value)} autoFocus fullWidth required
                disabled={salvando} slotProps={{ htmlInput: { maxLength: 100 } }} />
            {sub && <SeletorCategoria value={categoria} onChange={setCategoria} disabled={salvando} />}
            <FormControlLabel control={<Checkbox checked={ativo} disabled={salvando} onChange={e => setAtivo(e.target.checked)} />} label="Ativa" />
        </Stack>
    </CadastroDialog>;
}

function Listagem({ sub }: { sub: boolean }) {
    const [termo, setTermo] = useState("");
    const [busca, setBusca] = useState("");
    const [situacao, setSituacao] = useState("ativas");
    const [pagina, setPagina] = useState(0);
    const [size, setSize] = useState(25);
    const [ordem, setOrdem] = useState<{ campo: string; direcao: "asc" | "desc" }>({ campo: "nome", direcao: "asc" });
    const [categoria, setCategoria] = useState<CategoriaProduto | null>(null);
    const [dados, setDados] = useState<PaginaResponse<CategoriaProduto | SubcategoriaProduto> | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [aviso, setAviso] = useState("");
    const [revisao, setRevisao] = useState(0);
    const [form, setForm] = useState<{ registro: CategoriaProduto | SubcategoriaProduto | null } | null>(null);
    const [exclusao, setExclusao] = useState<CategoriaProduto | null>(null);
    const [excluindo, setExcluindo] = useState(false);
    const [erroExclusao, setErroExclusao] = useState("");
    useEffect(() => { const timer = setTimeout(() => { setBusca(termo); setPagina(0); }, 350); return () => clearTimeout(timer); }, [termo]);
    useEffect(() => {
        const controle = new AbortController();
        const timer = setTimeout(() => {
            setCarregando(true); setErro("");
            const params = { termo: busca, ativo: situacao === "todas" ? undefined : situacao === "ativas", page: pagina, size, sort: `${ordem.campo},${ordem.direcao}` };
            const consulta = sub ? listarSubcategorias({ ...params, categoriaId: categoria?.id }, controle.signal) : listarCategorias(params, controle.signal);
            consulta.then(resultado => {
                if (controle.signal.aborted) return;
                if (pagina > 0 && resultado.items.length === 0) { setPagina(Math.max(0, resultado.totalPages - 1)); return; }
                setDados(resultado);
            }).catch(e => { if (!controle.signal.aborted) { setDados(null); setErro(mensagemCategoria(e, "Não foi possível carregar os cadastros.")); } })
                .finally(() => { if (!controle.signal.aborted) setCarregando(false); });
        }, 0);
        return () => { clearTimeout(timer); controle.abort(); };
    }, [sub, busca, situacao, pagina, size, ordem, categoria?.id, revisao]);
    const colunas: Coluna<CategoriaProduto | SubcategoriaProduto>[] = [
        { campo: "nome", cabecalho: "Nome", ordenavel: true },
        ...(sub ? [{ campo: "categoria", cabecalho: "Categoria", render: (_: unknown, linha: CategoriaProduto | SubcategoriaProduto) => "categoria" in linha ? linha.categoria.nome : "" }] : []),
        { campo: "ativo", cabecalho: "Situação", ordenavel: true, render: (_, linha) => <Chip size="small" label={linha.ativo ? "Ativa" : "Inativa"} color={linha.ativo ? "success" : "default"} variant="outlined" /> },
    ];
    async function excluir() {
        if (!exclusao || excluindo) return;
        setExcluindo(true); setErroExclusao("");
        try {
            if (sub) await excluirSubcategoria(exclusao.id); else await excluirCategoria(exclusao.id);
            setExclusao(null); setAviso("Cadastro excluído."); setRevisao(v => v + 1);
        } catch (e) { setErroExclusao(mensagemCategoria(e, "Não foi possível excluir o cadastro.")); }
        finally { setExcluindo(false); }
    }
    return <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" } }}>
            <Stack><Typography variant="h6" component="h2">{sub ? "Subcategorias" : "Categorias"}</Typography>
                <Typography variant="body2" color="text.secondary">{sub ? "Cada subcategoria pertence a uma categoria da empresa." : "Mantenha os grupos do catálogo. A situação não altera as subcategorias."}</Typography></Stack>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setForm({ registro: null })}>{sub ? "Nova subcategoria" : "Nova categoria"}</Button>
        </Stack>
        {aviso && <Alert severity="success" onClose={() => setAviso("")}>{aviso}</Alert>}
        <PageFilters busca={{ placeholder: "Buscar por nome…", valor: termo, onChange: setTermo, carregando }}>
            <TextField select size="small" label="Situação" value={situacao} onChange={e => { setSituacao(e.target.value); setPagina(0); }} sx={{ minWidth: 140 }}>
                <MenuItem value="ativas">Ativas</MenuItem><MenuItem value="inativas">Inativas</MenuItem><MenuItem value="todas">Todas</MenuItem>
            </TextField>
            {sub && <Stack sx={{ width: { xs: "100%", sm: 280 }, minWidth: 0 }}><SeletorCategoria value={categoria} onChange={c => { setCategoria(c); setPagina(0); }} /></Stack>}
        </PageFilters>
        {erro ? <Alert severity="error" action={<Button color="inherit" onClick={() => setRevisao(v => v + 1)}>Tentar novamente</Button>}>{erro}</Alert>
            : <AppTable colunas={colunas} linhas={dados?.items ?? []} obterChaveLinha={linha => linha.id} carregando={carregando} minWidth={sub ? 520 : 380}
                vazio={{ titulo: "Nenhum cadastro encontrado", descricao: "Revise os filtros ou crie um cadastro." }}
                acoes={[
                    { rotulo: "Editar", icone: <EditRoundedIcon />, onClick: registro => setForm({ registro }), desabilitado: () => carregando },
                    { rotulo: "Excluir", icone: <DeleteOutlineRoundedIcon />, cor: "error", onClick: registro => { setErroExclusao(""); setExclusao(registro); }, desabilitado: () => carregando },
                ]}
                ordenacaoRemota ordenacao={{ ...ordem, onSort: campo => { setOrdem({ campo, direcao: ordem.campo === campo && ordem.direcao === "asc" ? "desc" : "asc" }); setPagina(0); } }}
                paginacao={{ pagina, linhasPorPagina: size, total: dados?.totalItems ?? 0, onPageChange: setPagina,
                    onRowsPerPageChange: valor => { setSize(valor); setPagina(0); }, opcoesLinhasPorPagina: [10, 25, 50] }} />}
        {form && <Cadastro sub={sub} registro={form.registro} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); setAviso("Cadastro salvo."); setRevisao(v => v + 1); }} />}
        <Dialog open={Boolean(exclusao)} onClose={excluindo ? undefined : () => setExclusao(null)} aria-labelledby="excluir-categoria-titulo">
            <DialogTitle id="excluir-categoria-titulo">Excluir {sub ? "subcategoria" : "categoria"}?</DialogTitle>
            <DialogContent><DialogContentText>Excluir “{exclusao?.nome}” é definitivo. Para manter o cadastro, edite e desmarque Ativa.</DialogContentText>
                {!sub && <DialogContentText sx={{ mt: 1 }}>Categorias com subcategorias não podem ser excluídas.</DialogContentText>}
                {erroExclusao && <Alert severity="error" sx={{ mt: 2 }}>{erroExclusao}</Alert>}
            </DialogContent>
            <DialogActions><Button disabled={excluindo} onClick={() => setExclusao(null)}>Voltar</Button><Button color="error" disabled={excluindo} onClick={excluir}>{excluindo ? "Excluindo…" : "Excluir"}</Button></DialogActions>
        </Dialog>
    </Stack>;
}

export default function CategoriasProdutos() {
    const [params, setParams] = useSearchParams();
    const sub = params.get("aba") === "subcategorias";
    return <PageContainer>
        <PageHeader titulo="Categorias de produtos" descricao="Cadastros de categorias e subcategorias da empresa, em dois níveis." />
        <Tabs value={sub ? "subcategorias" : "categorias"} onChange={(_, valor) => {
            const proximos = new URLSearchParams(params); proximos.set("aba", valor); setParams(proximos);
        }} aria-label="Cadastros de categorias" variant="scrollable" scrollButtons="auto">
            <Tab value="categorias" label="Categorias" id="aba-categorias" aria-controls="painel-categorias" />
            <Tab value="subcategorias" label="Subcategorias" id="aba-subcategorias" aria-controls="painel-subcategorias" />
        </Tabs>
        <div role="tabpanel" id={`painel-${sub ? "subcategorias" : "categorias"}`} aria-labelledby={`aba-${sub ? "subcategorias" : "categorias"}`}>
            <Listagem key={sub ? "subcategorias" : "categorias"} sub={sub} />
        </div>
    </PageContainer>;
}
