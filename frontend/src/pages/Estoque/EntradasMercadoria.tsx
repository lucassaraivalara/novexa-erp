import { useEffect, useRef, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import PageFilters from "../../components/ui/PageFilters";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import StatusChip from "../../components/ui/StatusChip";
import FornecedorAutocomplete, { type FornecedorOpcao } from "../../components/fornecedores/FornecedorAutocomplete";
import { buscarEntradaPorId, cancelarEntrada, listarEntradas } from "../../services/entradaMercadoriaService";
import { obterMensagemDaApi } from "../../services/produtoService";
import type { EntradaMercadoria, StatusEntradaMercadoria } from "../../types/entradaMercadoria";
import EntradaMercadoriaForm from "./EntradaMercadoriaForm";
import EntradaXmlImportacao from "./EntradaXmlImportacao";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const data = (valor: string) => new Intl.DateTimeFormat("pt-BR").format(new Date(`${valor}T12:00:00`));

export default function EntradasMercadoria() {
    const [linhas, setLinhas] = useState<EntradaMercadoria[]>([]);
    const [total, setTotal] = useState(0);
    const [pagina, setPagina] = useState(0);
    const [size, setSize] = useState(25);
    const [termo, setTermo] = useState("");
    const [status, setStatus] = useState<StatusEntradaMercadoria | "">("");
    const [fornecedor, setFornecedor] = useState<FornecedorOpcao | null>(null);
    const [periodo, setPeriodo] = useState({ dataInicial: "", dataFinal: "" });
    const [ordem, setOrdem] = useState({ campo: "dataEntrada", direcao: "desc" as "asc" | "desc" });
    const [revisao, setRevisao] = useState(0);
    const [carregando, setCarregando] = useState(true);
    const [ocupado, setOcupado] = useState(false);
    const operando = useRef(false);
    const [erro, setErro] = useState("");
    const [sucesso, setSucesso] = useState("");
    const [formulario, setFormulario] = useState<{ entrada: EntradaMercadoria | null } | null>(null);
    const [importandoXml, setImportandoXml] = useState(false);
    const [cancelamento, setCancelamento] = useState<EntradaMercadoria | null>(null);
    const atualizar = () => setRevisao(n => n + 1);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setCarregando(true);
            listarEntradas({ page: pagina, size, sort: `${ordem.campo},${ordem.direcao}`, termo: termo.trim() || undefined,
                status: status || undefined, fornecedorId: fornecedor?.id,
                dataInicial: periodo.dataInicial || undefined, dataFinal: periodo.dataFinal || undefined }, controller.signal)
                .then(p => { if (!controller.signal.aborted) {
                    setLinhas(p.items); setTotal(p.totalItems); setErro("");
                    if (pagina > 0 && !p.items.length) setPagina(Math.max(0, p.totalPages - 1));
                } })
                .catch(e => { if (!controller.signal.aborted) setErro(obterMensagemDaApi(e, "Não foi possível carregar as entradas.")); })
                .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        }, termo.trim() ? 350 : 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [pagina, size, termo, status, fornecedor, periodo, ordem, revisao]);

    async function abrir(linha: EntradaMercadoria) {
        if (operando.current) return;
        operando.current = true; setOcupado(true); setErro("");
        try { setFormulario({ entrada: await buscarEntradaPorId(linha.id) }); }
        catch (e) { setErro(obterMensagemDaApi(e, "Não foi possível abrir a entrada.")); }
        finally { operando.current = false; setOcupado(false); }
    }
    async function cancelar() {
        if (!cancelamento || operando.current) return;
        operando.current = true; setOcupado(true); setErro("");
        try {
            await cancelarEntrada(cancelamento.id); setCancelamento(null); atualizar(); setSucesso("Entrada cancelada. Estoque revertido.");
        } catch (e) { setErro(obterMensagemDaApi(e, "Não foi possível cancelar a entrada.")); }
        finally { operando.current = false; setOcupado(false); }
    }
    const colunas: Coluna<EntradaMercadoria>[] = [
        { campo: "dataEntrada", cabecalho: "Data", ordenavel: true, render: v => data(String(v)) },
        { campo: "fornecedorNome", cabecalho: "Fornecedor" },
        { campo: "numeroNota", cabecalho: "Nota", ordenavel: true, render: (_, e) => e.numeroNota ? `${e.numeroNota}${e.serie ? ` / ${e.serie}` : ""}` : "Não informada" },
        { campo: "valorTotal", cabecalho: "Valor", ordenavel: true, alinhar: "right", render: v => moeda.format(Number(v)) },
        { campo: "status", cabecalho: "Status", ordenavel: true, render: v => <StatusChip status={String(v)} /> },
    ];
    const acoes: AcaoTabela<EntradaMercadoria>[] = [
        { rotulo: "Visualizar entrada", icone: <VisibilityOutlinedIcon />, onClick: e => void abrir(e), desabilitado: () => ocupado },
        { rotulo: "Editar entrada", icone: <EditOutlinedIcon />, onClick: e => void abrir(e), desabilitado: e => ocupado || e.status !== "RASCUNHO" },
        { rotulo: "Cancelar entrada", icone: <BlockOutlinedIcon />, cor: "error", onClick: setCancelamento, desabilitado: e => ocupado || e.status !== "CONFIRMADA" },
    ];
    return <PageContainer>
        <PageHeader titulo="Entradas de mercadoria" descricao="Registre e acompanhe o recebimento de mercadorias."
            acoesSecundarias={<Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} disabled={ocupado}
                onClick={() => { setSucesso(""); setImportandoXml(true); }}>Importar XML</Button>}
            acaoPrincipal={<Button variant="contained" startIcon={<AddRoundedIcon />} disabled={ocupado}
                onClick={() => { setSucesso(""); setFormulario({ entrada: null }); }}>Entrada manual</Button>} />
        {erro && <Alert severity="error" onClose={() => setErro("")}>{erro}</Alert>}
        {sucesso && <Alert severity="success" onClose={() => setSucesso("")}>{sucesso}</Alert>}
        <PageFilters busca={{ valor: termo, placeholder: "Buscar por nota ou fornecedor…", onChange: v => { setPagina(0); setTermo(v); } }}>
            <TextField label="Status" select size="small" value={status} sx={{ minWidth: 140 }}
                onChange={e => { setPagina(0); setStatus(e.target.value as StatusEntradaMercadoria | ""); }}>
                <MenuItem value="">Todos</MenuItem><MenuItem value="RASCUNHO">Rascunho</MenuItem>
                <MenuItem value="CONFIRMADA">Confirmada</MenuItem><MenuItem value="CANCELADA">Cancelada</MenuItem>
            </TextField>
            <FornecedorAutocomplete value={fornecedor} onChange={f => { setPagina(0); setFornecedor(f); }} size="small" minWidth={220} />
            {(["dataInicial", "dataFinal"] as const).map(campo => <TextField key={campo} type="date" size="small"
                label={campo === "dataInicial" ? "Data inicial" : "Data final"} value={periodo[campo]} slotProps={{ inputLabel: { shrink: true } }}
                onChange={e => { setPagina(0); setPeriodo(p => ({ ...p, [campo]: e.target.value })); }} />)}
        </PageFilters>
        <AppTable colunas={colunas} linhas={linhas} obterChaveLinha={e => e.id} carregando={carregando} acoes={acoes} minWidth={800}
            vazio={{ titulo: "Nenhuma entrada encontrada" }} ordenacaoRemota
            ordenacao={{ campo: ordem.campo, direcao: ordem.direcao, onSort: campo => { setPagina(0);
                setOrdem(o => ({ campo, direcao: o.campo === campo && o.direcao === "asc" ? "desc" : "asc" })); } }}
            paginacao={{ pagina, linhasPorPagina: size, total, onPageChange: setPagina,
                onRowsPerPageChange: valor => { setPagina(0); setSize(valor); }, opcoesLinhasPorPagina: [10, 25, 50] }} />
        {formulario && <EntradaMercadoriaForm entrada={formulario.entrada} onFechar={() => { setFormulario(null); atualizar(); }}
            onAtualizar={atualizar} onConcluido={e => { setFormulario(null); atualizar();
                setSucesso(e.status === "CONFIRMADA" ? "Entrada confirmada. Estoque atualizado." : e.status === "CANCELADA" ? "Entrada já cancelada." : "Rascunho salvo."); }} />}
        {importandoXml && <EntradaXmlImportacao onFechar={() => { setImportandoXml(false); atualizar(); }} onAtualizar={atualizar}
            onConcluido={e => { setImportandoXml(false); atualizar();
                setSucesso(e.status === "CONFIRMADA" ? "Entrada confirmada. Estoque atualizado." : e.status === "CANCELADA" ? "Entrada já cancelada." : "Rascunho salvo."); }} />}
        <Dialog open={cancelamento !== null} onClose={ocupado ? undefined : () => setCancelamento(null)} fullWidth maxWidth="xs" aria-labelledby="entrada-cancelamento-titulo">
            <DialogTitle id="entrada-cancelamento-titulo">Cancelar esta entrada?</DialogTitle>
            <DialogContent>
                <Typography>O estoque dos produtos será revertido e a entrada permanecerá no histórico.</Typography>
                {erro && <Alert severity="error" sx={{ mt: 2 }}>{erro}</Alert>}
            </DialogContent>
            <DialogActions><Button disabled={ocupado} onClick={() => setCancelamento(null)}>Voltar</Button>
                <Button color="error" variant="contained" disabled={ocupado} onClick={() => void cancelar()}>Cancelar entrada</Button></DialogActions>
        </Dialog>
    </PageContainer>;
}
