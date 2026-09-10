import { useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Alert, Button, Chip, CircularProgress, IconButton, InputAdornment, MenuItem, Paper, Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import PageIntro from "../../components/layout/PageIntro";
import { buscarCliente, listarClientes, mensagemCliente } from "../../services/clienteService";
import type { Cliente } from "../../types/cliente";
import { obterEmpresaAtiva } from "../../utils/auth/sessao";
import ClienteForm from "./ClienteForm";

const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function Clientes() {
    const empresaId = obterEmpresaAtiva()?.id;
    const [clientes, setClientes] = useState<Cliente[]>([]); const [busca, setBusca] = useState(""); const [situacao, setSituacao] = useState("todos");
    const [pagina, setPagina] = useState(0); const [carregando, setCarregando] = useState(true); const [erro, setErro] = useState(""); const [mensagem, setMensagem] = useState("");
    const [edicao, setEdicao] = useState<Cliente | null | undefined>(undefined); const [abrindo, setAbrindo] = useState<number | null>(null);
    const [revisao, setRevisao] = useState(0);
    useEffect(() => { const controller = new AbortController(); if (!empresaId) return; listarClientes(empresaId, controller.signal).then(setClientes).catch(e => { if (!controller.signal.aborted) setErro(mensagemCliente(e, "Não foi possível carregar os clientes.")); }).finally(() => { if (!controller.signal.aborted) setCarregando(false); }); return () => controller.abort(); }, [empresaId, revisao]);
    const filtrados = useMemo(() => clientes.filter(c => { const termo = normalizar(busca.trim()); const documento = busca.replace(/\D/g, ""); const bate = !termo || normalizar([c.id, c.nome, c.nomeFantasia, c.cpfCnpj].join(" ")).includes(termo) || (documento.length > 0 && (c.cpfCnpj ?? "").includes(documento)); return (situacao === "todos" || c.ativo === (situacao === "ativos")) && bate; }), [clientes, busca, situacao]);
    const paginaAtual = Math.min(pagina, Math.max(0, Math.ceil(filtrados.length / 10) - 1));
    async function abrir(c: Cliente) { if (!empresaId) return; setAbrindo(c.id); try { setEdicao(await buscarCliente(c.id, empresaId)); } catch (e) { setErro(mensagemCliente(e, "Não foi possível abrir o cliente.")); } finally { setAbrindo(null); } }
    if (!empresaId) return <Alert severity="warning">Selecione uma empresa para consultar os clientes.</Alert>;
    return <Stack spacing={3}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}><PageIntro titulo="Clientes" descricao="Cadastros, contatos e condições comerciais em um só lugar." /><Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEdicao(null)}>Novo Cliente</Button></Stack>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}><Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField fullWidth label="Pesquisar clientes" placeholder="Nome, razão social, CPF/CNPJ ou código" value={busca} onChange={e => { setBusca(e.target.value); setPagina(0); }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> } }} /><TextField select label="Situação" value={situacao} sx={{ minWidth: 180 }} onChange={e => { setSituacao(e.target.value); setPagina(0); }}><MenuItem value="todos">Todas</MenuItem><MenuItem value="ativos">Ativos</MenuItem><MenuItem value="inativos">Inativos</MenuItem></TextField></Stack></Paper>
        {erro && <Alert severity="error" action={<Button color="inherit" onClick={() => { setErro(""); setCarregando(true); setRevisao(v => v + 1); }}>Recarregar</Button>}>{erro}</Alert>}
        <Paper variant="outlined" sx={{ overflow: "hidden" }}><TableContainer><Table sx={{ minWidth: 1000 }}><TableHead><TableRow>{["Código", "Nome / Razão social", "Nome fantasia", "CPF/CNPJ", "Cidade / UF", "Telefone", "Situação", "Ações"].map(t => <TableCell key={t}>{t}</TableCell>)}</TableRow></TableHead><TableBody>{carregando ? <TableRow><TableCell colSpan={8} align="center"><CircularProgress size={28} /></TableCell></TableRow> : filtrados.length === 0 ? <TableRow><TableCell colSpan={8} sx={{ py: 6 }} align="center"><Typography color="text.secondary">{busca || situacao !== "todos" ? "Nenhum cliente encontrado para os filtros selecionados." : "Nenhum cliente cadastrado. Comece em Novo Cliente."}</Typography></TableCell></TableRow> : filtrados.slice(paginaAtual * 10, paginaAtual * 10 + 10).map(c => { const e = c.enderecos?.find(x => x.principal) ?? c.enderecos?.[0]; return <TableRow key={c.id} hover><TableCell>{c.id}</TableCell><TableCell><Button sx={{ textTransform: "none" }} disabled={abrindo !== null} onClick={() => void abrir(c)}>{c.nome}</Button></TableCell><TableCell>{c.nomeFantasia || "—"}</TableCell><TableCell>{c.cpfCnpj || "—"}</TableCell><TableCell>{e ? `${e.cidade} / ${e.uf}` : "—"}</TableCell><TableCell>{c.telefone || "—"}</TableCell><TableCell><Chip size="small" color={c.ativo ? "success" : "default"} variant="outlined" label={c.ativo ? "Ativo" : "Inativo"} /></TableCell><TableCell><Tooltip title="Editar cliente"><span><IconButton aria-label={`Editar ${c.nome}`} disabled={abrindo !== null} onClick={() => void abrir(c)}>{abrindo === c.id ? <CircularProgress size={20} /> : <EditOutlinedIcon />}</IconButton></span></Tooltip></TableCell></TableRow>; })}</TableBody></Table></TableContainer><TablePagination component="div" count={filtrados.length} page={paginaAtual} rowsPerPage={10} rowsPerPageOptions={[10]} onPageChange={(_, p) => setPagina(p)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`} /></Paper>
        {edicao !== undefined && <ClienteForm key={edicao?.id ?? "novo"} cliente={edicao} empresaId={empresaId} onFechar={() => setEdicao(undefined)} onSalvo={c => { setClientes(lista => [...lista.filter(x => x.id !== c.id), c].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))); setEdicao(undefined); setMensagem("Cliente salvo com sucesso."); }} />}
        <Snackbar open={!!mensagem} autoHideDuration={5000} onClose={() => setMensagem("")} message={mensagem} />
    </Stack>;
}
