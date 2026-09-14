import { useEffect, useRef, useState } from "react";
import { Alert, Button, Chip, MenuItem, Snackbar, Stack, FormControl, Select } from "@mui/material";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type Coluna, type AcaoTabela } from "../../components/ui/AppTable";
import { listarCaixas, buscarCaixa, inativarCaixa, mensagemCaixa } from "../../services/caixaService";
import type { CaixaCompleta, CaixaResumo } from "../../types/caixa";
import CaixaForm from "./CaixaForm";

const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

export default function Caixa() {
    const [caixas, setCaixas] = useState<CaixaResumo[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [busca, setBusca] = useState("");
    const [situacao, setSituacao] = useState("todas");
    const [pagina, setPagina] = useState(0);
    const [porPagina, setPorPagina] = useState(10);
    const [abrindo, setAbrindo] = useState<number | null>(null);
    const [editor, setEditor] = useState<{ caixa: CaixaCompleta | null } | null>(null);
    const [sucesso, setSucesso] = useState(false);
    const abertura = useRef<AbortController | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        listarCaixas(controller.signal)
            .then(setCaixas)
            .catch((e) => {
                if (!controller.signal.aborted) setErro(mensagemCaixa(e, "Não foi possível carregar os caixas."));
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => {
            controller.abort();
            abertura.current?.abort();
        };
    }, [tentativa]);

    async function editar(id: number) {
        abertura.current?.abort();
        const controller = new AbortController();
        abertura.current = controller;
        setAbrindo(id);
        setErro("");
        try {
            const caixa = await buscarCaixa(id, controller.signal);
            if (!controller.signal.aborted) setEditor({ caixa });
        } catch (e) {
            if (!controller.signal.aborted) setErro(mensagemCaixa(e, "Não foi possível abrir o caixa."));
        } finally {
            if (!controller.signal.aborted) setAbrindo(null);
        }
    }

    async function inativar(id: number) {
        if (!window.confirm("Tem certeza que deseja inativar este caixa?")) return;
        setErro("");
        try {
            await inativarCaixa(id);
            setCaixas((atuais) => atuais.map((c) => (c.id === id ? { ...c, ativo: false } : c)));
            setSucesso(true);
        } catch (e) {
            setErro(mensagemCaixa(e, "Não foi possível inativar o caixa."));
        }
    }

    function salvo(caixa: CaixaCompleta) {
        setCaixas((atuais) => atuais.some((c) => c.id === caixa.id) ? atuais.map((c) => (c.id === caixa.id ? caixa : c)) : [...atuais, caixa]);
        setEditor(null);
        setSucesso(true);
    }

    const termo = normalizar(busca);
    const filtradas = caixas.filter(
        (c) =>
            (!termo || normalizar(c.descricao).includes(termo)) &&
            (situacao === "todas" || c.ativo === (situacao === "ativas"))
    );
    const paginaAtual = Math.min(pagina, Math.max(0, Math.ceil(filtradas.length / porPagina) - 1));

    const renderAtivo = (valor: unknown): React.ReactNode =>
        <Chip size="small" label={valor ? "Sim" : "Não"} color={valor ? "success" : "default"} variant="outlined" />;

    const colunas: Coluna<CaixaResumo>[] = [
        { campo: "id", cabecalho: "Código", largura: 80 },
        { campo: "descricao", cabecalho: "Descrição", largura: 300 },
        { campo: "ativo", cabecalho: "Ativo", largura: 100, render: renderAtivo },
    ];

    const acoes: AcaoTabela<CaixaResumo>[] = [
        {
            rotulo: "Editar",
            icone: <span>Editar</span>,
            onClick: (c) => editar(c.id),
            desabilitado: () => abrindo !== null,
            tooltip: "Editar caixa",
        },
        {
            rotulo: "Inativar",
            icone: <span>Inativar</span>,
            onClick: (c) => inativar(c.id),
            desabilitado: (c) => abrindo !== null || !c.ativo,
            cor: "error",
            tooltip: "Inativar caixa",
        },
    ];

    return (
        <Stack spacing={2.5}>
            <PageHeader
                titulo="Caixas"
                descricao="Gerencie os caixas financeiros da empresa."
                acaoPrincipal={<Button variant="contained" disabled={abrindo !== null} onClick={() => setEditor({ caixa: null })}>Novo Caixa</Button>}
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
                obterChaveLinha={(c) => c.id}
                busca={{
                    placeholder: "Buscar por descrição",
                    onChange: (v) => { setBusca(v); setPagina(0); },
                    valor: busca,
                }}
                filtros={
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <Select label="Situação" value={situacao} onChange={(e) => { setSituacao(e.target.value); setPagina(0); }}>
                            <MenuItem value="todas">Todas</MenuItem>
                            <MenuItem value="ativas">Ativas</MenuItem>
                            <MenuItem value="inativos">Inativas</MenuItem>
                        </Select>
                    </FormControl>
                }
                vazio={{
                    titulo: "Nenhum caixa encontrado",
                    descricao: erro ? "Listagem indisponível." : "Cadastre um novo caixa para começar.",
                }}
                acoes={acoes}
                paginacao={{
                    pagina: paginaAtual,
                    linhasPorPagina: porPagina,
                    total: filtradas.length,
                    onPageChange: setPagina,
                    onRowsPerPageChange: (linhas: number) => { setPorPagina(linhas); setPagina(0); },
                    opcoesLinhasPorPagina: [10, 25, 50],
                }}
                minWidth={800}
            />

            {editor && <CaixaForm caixa={editor.caixa} onFechar={() => setEditor(null)} onSalvo={salvo} />}

            <Snackbar open={sucesso} autoHideDuration={5000} onClose={() => setSucesso(false)}>
                <Alert severity="success" onClose={() => setSucesso(false)}>Caixa salvo com sucesso.</Alert>
            </Snackbar>
        </Stack>
    );
}