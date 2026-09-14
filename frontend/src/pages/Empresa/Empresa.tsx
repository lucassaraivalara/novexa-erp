import { useEffect, useRef, useState } from "react";
import { Alert, Button, Chip, MenuItem, Snackbar, Stack, FormControl, InputLabel, Select } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type Coluna, type AcaoTabela } from "../../components/ui/AppTable";
import { buscarEmpresa, listarEmpresas, mensagemEmpresa } from "../../services/empresaService";
import type { EmpresaCompleta, EmpresaResumo } from "../../types/empresa";
import EmpresaForm from "./EmpresaForm";
import { regimes } from "./empresaFormulario";
import { formatarDocumentoEmpresa } from "../../utils/validators/documentoEmpresa";

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
    const [ordenacao, setOrdenacao] = useState<{ campo: string; direcao: "asc" | "desc" }>({ campo: "razaoSocial", direcao: "asc" });
    const [abrindo, setAbrindo] = useState<number | null>(null);
    const [editor, setEditor] = useState<{ empresa: EmpresaCompleta | null; aba: number } | null>(null);
    const [sucesso, setSucesso] = useState(false);
    const abertura = useRef<AbortController | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        listarEmpresas(controller.signal)
            .then(setEmpresas)
            .catch((e) => {
                if (!controller.signal.aborted) setErro(mensagemEmpresa(e, "Não foi possível carregar as empresas."));
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => {
            controller.abort();
            abertura.current?.abort();
        };
    }, [tentativa]);

    async function editar(id: number, aba = 0) {
        abertura.current?.abort();
        const controller = new AbortController();
        abertura.current = controller;
        setAbrindo(id);
        setErro("");
        try {
            const empresa = await buscarEmpresa(id, controller.signal);
            if (!controller.signal.aborted) setEditor({ empresa, aba });
        } catch (e) {
            if (!controller.signal.aborted) setErro(mensagemEmpresa(e, "Não foi possível abrir a empresa."));
        } finally {
            if (!controller.signal.aborted) setAbrindo(null);
        }
    }

    function salvo(empresa: EmpresaCompleta) {
        setEmpresas((atuais) => atuais.some((e) => e.id === empresa.id) ? atuais.map((e) => (e.id === empresa.id ? empresa : e)) : [...atuais, empresa]);
        setEditor(null);
        setSucesso(true);
    }

    const termo = normalizar(busca);
    const filtradas = empresas.filter(
        (e) =>
            (!termo || normalizar(e.razaoSocial).includes(termo) || normalizar(e.cnpj).includes(termo)) &&
            (situacao === "todas" || e.ativo === (situacao === "ativas"))
    );
    const paginaAtual = Math.min(pagina, Math.max(0, Math.ceil(filtradas.length / porPagina) - 1));

    const renderFantasia = (valor: unknown): React.ReactNode => String(valor ?? "—");
    const renderCnpj = (valor: unknown): React.ReactNode => <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{formatarDocumentoEmpresa(String(valor), String(valor).replace(/\D/g, "").length === 11)}</span>;
    const renderRegime = (_: unknown, linha: EmpresaResumo): React.ReactNode =>
        regimes.find(([v]) => v === linha.cadastro?.regimeTributario)?.[1] ?? "Não informado";
    const renderUf = (valor: unknown): React.ReactNode => String(valor ?? "—");
    const renderAtivo = (valor: unknown): React.ReactNode => <Chip size="small" label={valor ? "Ativa" : "Inativa"} color={valor ? "success" : "default"} variant={valor ? "filled" : "outlined"} />;

    const colunas: Coluna<EmpresaResumo>[] = [
        { campo: "id", cabecalho: "Código", largura: 80, ordenavel: true },
        { campo: "razaoSocial", cabecalho: "Razão Social", largura: 280, ordenavel: true },
        { campo: "nomeFantasia", cabecalho: "Nome Fantasia", largura: 200, render: renderFantasia },
        { campo: "cnpj", cabecalho: "CNPJ / CPF", largura: 160, render: renderCnpj },
        { campo: "cadastro.regimeTributario", cabecalho: "Regime Tributário", largura: 200, render: renderRegime },
        { campo: "cadastro.uf", cabecalho: "UF", largura: 80, render: renderUf },
        { campo: "ativo", cabecalho: "Ativo", largura: 100, render: renderAtivo },
    ];

    const acoes: AcaoTabela<EmpresaResumo>[] = [
        {
            rotulo: "Editar",
            icone: <EditOutlinedIcon fontSize="small" />,
            onClick: (e) => editar(e.id),
            desabilitado: () => abrindo !== null,
            tooltip: "Editar empresa",
        },
        {
            rotulo: "Inscrições",
            icone: <AssignmentOutlinedIcon fontSize="small" />,
            onClick: (e) => editar(e.id, 3),
            desabilitado: () => abrindo !== null,
            tooltip: "Inscrições estaduais/municipais",
        },
    ];

    return (
        <Stack spacing={2.5}>
            <PageHeader
                titulo="Empresas"
                descricao="Gerencie os dados cadastrais e fiscais das empresas."
                acaoPrincipal={<Button variant="contained" startIcon={<AddRoundedIcon />} disabled={abrindo !== null} onClick={() => setEditor({ empresa: null, aba: 0 })}>Nova empresa</Button>}
            />

            {erro && (
                <Alert severity="error" action={<Button color="inherit" onClick={() => { setErro(""); setCarregando(true); setTentativa((t) => t + 1); }}>Tentar novamente</Button>}>
                    {erro}
                </Alert>
            )}

            <AppTable
                colunas={colunas}
                linhas={filtradas}
                carregando={carregando}
                obterChaveLinha={(e) => e.id}
                busca={{
                    placeholder: "Buscar por Razão Social ou CNPJ / CPF",
                    onChange: (v) => { setBusca(v); setPagina(0); },
                    valor: busca,
                }}
                filtros={
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel id="empresa-situacao-label">Situação</InputLabel>
                        <Select labelId="empresa-situacao-label" label="Situação" value={situacao} onChange={(e) => { setSituacao(e.target.value); setPagina(0); }}>
                            <MenuItem value="todas">Todas</MenuItem>
                            <MenuItem value="ativas">Ativas</MenuItem>
                            <MenuItem value="inativos">Inativas</MenuItem>
                        </Select>
                    </FormControl>
                }
                vazio={{
                    titulo: "Nenhuma empresa encontrada",
                    descricao: erro ? "Listagem indisponível." : "Cadastre uma nova empresa para começar.",
                }}
                acoes={acoes}
                ordenacao={{ campo: ordenacao.campo, direcao: ordenacao.direcao, onSort: (campo) => setOrdenacao((atual) => ({ campo, direcao: atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc" })) }}
                paginacao={{
                    pagina: paginaAtual,
                    linhasPorPagina: porPagina,
                    total: filtradas.length,
                    onPageChange: setPagina,
                    onRowsPerPageChange: (linhas: number) => { setPorPagina(linhas); setPagina(0); },
                    opcoesLinhasPorPagina: [10, 25, 50],
                }}
                minWidth={1000}
            />

            {editor && <EmpresaForm empresa={editor.empresa} abaInicial={editor.aba} onFechar={() => setEditor(null)} onSalvo={salvo} />}

            <Snackbar open={sucesso} autoHideDuration={5000} onClose={() => setSucesso(false)}>
                <Alert severity="success" onClose={() => setSucesso(false)}>Empresa salva com sucesso.</Alert>
            </Snackbar>
        </Stack>
    );
}