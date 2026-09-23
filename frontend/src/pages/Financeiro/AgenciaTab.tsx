import { useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { Alert, Button, Chip, FormControl, MenuItem, Select, Snackbar, Stack } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageFilters from "../../components/ui/PageFilters";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import { listarAgencias, mensagemDadosBancarios, salvarAgencia } from "../../services/dadosBancariosService";
import type { AgenciaResumo } from "../../types/dadosBancarios";
import AgenciaForm from "./AgenciaForm";

const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function AgenciaTab() {
    const [agencias, setAgencias] = useState<AgenciaResumo[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [busca, setBusca] = useState("");
    const [banco, setBanco] = useState("todos");
    const [situacao, setSituacao] = useState("ativos");
    const [editor, setEditor] = useState<{ agencia: AgenciaResumo | null } | null>(null);
    const [alternando, setAlternando] = useState<number | null>(null);
    const [sucesso, setSucesso] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        listarAgencias(undefined, controller.signal)
            .then(setAgencias)
            .catch((e) => {
                if (!controller.signal.aborted) setErro(mensagemDadosBancarios(e, "Não foi possível carregar as agências."));
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [tentativa]);

    const bancosDisponiveis = useMemo(() => {
        const mapa = new Map<number, string>();
        agencias.forEach((a) => mapa.set(a.bancoId, a.bancoNome));
        return Array.from(mapa.entries());
    }, [agencias]);

    const filtradas = useMemo(() => {
        const termo = normalizar(busca.trim());
        return agencias.filter((a) =>
            (!termo || normalizar(`${a.numero} ${a.bancoNome} ${a.cidade ?? ""}`).includes(termo)) &&
            (banco === "todos" || a.bancoId === Number(banco)) &&
            (situacao === "todos" || a.ativo === (situacao === "ativos")));
    }, [agencias, busca, banco, situacao]);

    async function alternarSituacao(agencia: AgenciaResumo) {
        setAlternando(agencia.id);
        setErro("");
        try {
            const salva = await salvarAgencia({
                bancoId: agencia.bancoId, numero: agencia.numero, digito: agencia.digito,
                contato: agencia.contato, telefone: agencia.telefone, cidade: agencia.cidade, ativo: !agencia.ativo,
            }, agencia.id);
            setAgencias((atuais) => atuais.map((a) => (a.id === salva.id ? salva : a)));
            setSucesso(true);
        } catch (e) {
            setErro(mensagemDadosBancarios(e, "Não foi possível alterar a situação da agência."));
        } finally {
            setAlternando(null);
        }
    }

    function salva(agencia: AgenciaResumo) {
        setAgencias((atuais) => atuais.some((a) => a.id === agencia.id) ? atuais.map((a) => (a.id === agencia.id ? agencia : a)) : [...atuais, agencia]);
        setEditor(null);
        setSucesso(true);
    }

    const colunas: Coluna<AgenciaResumo>[] = [
        { campo: "id", cabecalho: "Código", largura: 90 },
        { campo: "numero", cabecalho: "Número", largura: 100 },
        { campo: "digito", cabecalho: "Dígito", largura: 90, render: (valor) => String(valor ?? "—") },
        { campo: "bancoNome", cabecalho: "Banco", largura: 220 },
        { campo: "cidade", cabecalho: "Cidade", largura: 160, render: (valor) => String(valor ?? "—") },
        { campo: "contato", cabecalho: "Contato", largura: 160, render: (valor) => String(valor ?? "—") },
        {
            campo: "ativo", cabecalho: "Situação", largura: 110,
            render: (valor) => <Chip size="small" label={valor ? "Ativo" : "Inativo"} color={valor ? "success" : "default"} variant={valor ? "filled" : "outlined"} />,
        },
    ];

    const acoes: AcaoTabela<AgenciaResumo>[] = [
        { rotulo: "Editar", icone: <EditOutlinedIcon fontSize="small" />, onClick: (a) => setEditor({ agencia: a }), tooltip: "Editar agência" },
        {
            rotulo: "Inativar", icone: <BlockRoundedIcon fontSize="small" />, onClick: (a) => void alternarSituacao(a),
            desabilitado: () => alternando !== null, cor: "error", tooltip: "Ativar ou inativar agência",
        },
    ];

    return (
        <PageContainer>
            {erro && (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => { setErro(""); setCarregando(true); setTentativa((v) => v + 1); }}>Tentar novamente</Button>}>
                    {erro}
                </Alert>
            )}

            <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEditor({ agencia: null })}>Nova Agência</Button>
            </Stack>

            <Stack spacing={1}>
                <PageFilters busca={{ placeholder: "Pesquisar por número, banco ou cidade", valor: busca, onChange: setBusca }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <Select value={banco} onChange={(e) => setBanco(e.target.value)}>
                            <MenuItem value="todos">Todos os bancos</MenuItem>
                            {bancosDisponiveis.map(([id, nome]) => <MenuItem key={id} value={String(id)}>{nome}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <Select value={situacao} inputProps={{ "aria-label": "Filtrar agências por situação" }} onChange={(e) => setSituacao(e.target.value)}>
                            <MenuItem value="todos">Todos</MenuItem>
                            <MenuItem value="ativos">Ativos</MenuItem>
                            <MenuItem value="inativos">Inativos</MenuItem>
                        </Select>
                    </FormControl>
                </PageFilters>

                <AppTable
                    colunas={colunas}
                    linhas={filtradas}
                    carregando={carregando}
                    obterChaveLinha={(a) => a.id}
                    vazio={{
                        titulo: "Nenhuma agência encontrada",
                        descricao: busca || banco !== "todos" || situacao !== "todos" ? "Tente ajustar os filtros." : "Cadastre a primeira agência para começar.",
                    }}
                    acoes={acoes}
                    minWidth={940}
                />
            </Stack>

            {editor && <AgenciaForm agencia={editor.agencia} onFechar={() => setEditor(null)} onSalvo={salva} />}

            <Snackbar open={sucesso} autoHideDuration={4500} onClose={() => setSucesso(false)}>
                <Alert severity="success" onClose={() => setSucesso(false)}>Agência salva com sucesso.</Alert>
            </Snackbar>
        </PageContainer>
    );
}
