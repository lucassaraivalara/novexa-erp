import { useEffect, useRef, useState } from "react";
import { Alert, Button, Chip, CircularProgress, MenuItem, Paper, Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField } from "@mui/material";
import PageIntro from "../../components/layout/PageIntro";
import { buscarEmpresa, listarEmpresas, mensagemEmpresa } from "../../services/empresaService";
import type { EmpresaCompleta, EmpresaResumo } from "../../types/empresa";
import EmpresaForm from "./EmpresaForm";
import { regimes } from "./empresaFormulario";

const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

export default function Empresa() {
    const [empresas, setEmpresas] = useState<EmpresaResumo[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [busca, setBusca] = useState("");
    const [situacao, setSituacao] = useState("todas");
    const [pagina, setPagina] = useState(0);
    const [porPagina, setPorPagina] = useState(10);
    const [abrindo, setAbrindo] = useState<number | null>(null);
    const [editor, setEditor] = useState<{ empresa: EmpresaCompleta | null; aba: number } | null>(null);
    const [sucesso, setSucesso] = useState(false);
    const abertura = useRef<AbortController | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        listarEmpresas(controller.signal).then(setEmpresas).catch(e => {
            if (!controller.signal.aborted) setErro(mensagemEmpresa(e, "Não foi possível carregar as empresas."));
        }).finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        return () => { controller.abort(); abertura.current?.abort(); };
    }, [tentativa]);

    async function editar(id: number, aba = 0) {
        abertura.current?.abort();
        const controller = new AbortController(); abertura.current = controller;
        setAbrindo(id); setErro("");
        try {
            const empresa = await buscarEmpresa(id, controller.signal);
            if (!controller.signal.aborted) setEditor({ empresa, aba });
        } catch (e) { if (!controller.signal.aborted) setErro(mensagemEmpresa(e, "Não foi possível abrir a empresa.")); }
        finally { if (!controller.signal.aborted) setAbrindo(null); }
    }
    function salvo(empresa: EmpresaCompleta) {
        setEmpresas(atuais => atuais.some(e => e.id === empresa.id) ? atuais.map(e => e.id === empresa.id ? empresa : e) : [...atuais, empresa]);
        setEditor(null); setSucesso(true);
    }
    const termo = normalizar(busca);
    const filtradas = empresas.filter(e => (!termo || normalizar(e.razaoSocial).includes(termo) || normalizar(e.cnpj).includes(termo)) && (situacao === "todas" || e.ativo === (situacao === "ativas")));
    const paginaAtual = Math.min(pagina, Math.max(0, Math.ceil(filtradas.length / porPagina) - 1));

    return <Stack spacing={2.5}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2 }}>
            <PageIntro titulo="Empresas" descricao="Gerencie os dados cadastrais e fiscais das empresas." />
            <Button variant="contained" disabled={abrindo !== null} onClick={() => setEditor({ empresa: null, aba: 0 })}>Nova Empresa</Button>
        </Stack>
        {erro && <Alert severity="error" action={<Button color="inherit" onClick={() => { setErro(""); setCarregando(true); setTentativa(t => t + 1); }}>Tentar novamente</Button>}>{erro}</Alert>}
        <Paper variant="outlined">
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ p: 2 }}>
                <TextField fullWidth label="Buscar por Razão Social ou CNPJ / CPF" value={busca} onChange={e => { setBusca(e.target.value); setPagina(0); }} />
                <TextField select label="Situação" value={situacao} sx={{ minWidth: 160 }} onChange={e => { setSituacao(e.target.value); setPagina(0); }}>
                    <MenuItem value="todas">Todas</MenuItem><MenuItem value="ativas">Ativas</MenuItem><MenuItem value="inativas">Inativas</MenuItem>
                </TextField>
            </Stack>
            <TableContainer><Table aria-label="Empresas cadastradas" size="small">
                <TableHead><TableRow>{["Código", "Razão Social", "Nome Fantasia", "CNPJ / CPF", "Regime Tributário", "UF", "Ativo", "Ações"].map(t => <TableCell key={t}>{t}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                    {carregando ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress size={24} aria-label="Carregando empresas" /></TableCell></TableRow>
                        : !filtradas.length ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>{erro ? "Listagem indisponível." : "Nenhuma empresa encontrada."}</TableCell></TableRow>
                            : filtradas.slice(paginaAtual * porPagina, (paginaAtual + 1) * porPagina).map(e => <TableRow hover key={e.id}>
                                <TableCell>{e.id}</TableCell><TableCell>{e.razaoSocial}</TableCell><TableCell>{e.nomeFantasia || "—"}</TableCell><TableCell sx={{ whiteSpace: "nowrap" }}>{e.cnpj}</TableCell>
                                <TableCell>{regimes.find(([v]) => v === e.cadastro?.regimeTributario)?.[1] ?? "Não informado"}</TableCell><TableCell>{e.cadastro?.uf || "—"}</TableCell>
                                <TableCell><Chip size="small" label={e.ativo ? "Sim" : "Não"} color={e.ativo ? "success" : "default"} variant="outlined" /></TableCell>
                                <TableCell><Stack direction="row"><Button disabled={abrindo !== null} aria-label={`Editar empresa ${e.razaoSocial}`} onClick={() => void editar(e.id)}>{abrindo === e.id ? "Abrindo…" : "Editar"}</Button><Button disabled={abrindo !== null} aria-label={`Inscrições de ${e.razaoSocial}`} onClick={() => void editar(e.id, 3)}>Inscrições</Button></Stack></TableCell>
                            </TableRow>)}
                </TableBody>
            </Table></TableContainer>
            <TablePagination component="div" count={filtradas.length} page={paginaAtual} rowsPerPage={porPagina} onPageChange={(_, p) => setPagina(p)} onRowsPerPageChange={e => { setPorPagina(Number(e.target.value)); setPagina(0); }} rowsPerPageOptions={[10, 25, 50]} labelRowsPerPage="Por página" labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`} />
        </Paper>
        {editor && <EmpresaForm empresa={editor.empresa} abaInicial={editor.aba} onFechar={() => setEditor(null)} onSalvo={salvo} />}
        <Snackbar open={sucesso} autoHideDuration={5000} onClose={() => setSucesso(false)}><Alert severity="success" onClose={() => setSucesso(false)}>Empresa salva com sucesso.</Alert></Snackbar>
    </Stack>;
}
