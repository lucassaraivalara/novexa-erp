import { useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
    Alert, Button, Chip, MenuItem, Snackbar,
    FormControl, InputLabel, Select, Stack,
} from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type Coluna, type AcaoTabela } from "../../components/ui/AppTable";
import PageFilters from "../../components/ui/PageFilters";
import { buscarCliente, listarClientes, mensagemCliente } from "../../services/clienteService";
import type { Cliente } from "../../types/cliente";
import { obterEmpresaAtiva } from "../../utils/auth/sessao";
import ClienteForm from "./ClienteForm";

type CampoBuscaCliente = "id" | "nome" | "nomeFantasia" | "cpfCnpj" | "cidadeUf" | "telefone";
type ClienteTabela = Cliente & { cidadeUf: string };

const camposBusca: Record<CampoBuscaCliente, { rotulo: string; placeholder: string }> = {
    id: { rotulo: "Código", placeholder: "Pesquisar por código…" },
    nome: { rotulo: "Nome / Razão social", placeholder: "Pesquisar por nome ou razão social…" },
    nomeFantasia: { rotulo: "Nome fantasia", placeholder: "Pesquisar por nome fantasia…" },
    cpfCnpj: { rotulo: "CPF/CNPJ", placeholder: "Pesquisar por CPF ou CNPJ…" },
    cidadeUf: { rotulo: "Cidade / UF", placeholder: "Pesquisar por cidade ou UF…" },
    telefone: { rotulo: "Telefone", placeholder: "Pesquisar por telefone…" },
};

const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const obterCidadeUf = (cliente: Cliente) => {
    const endereco = cliente.enderecos?.find((item) => item.principal) ?? cliente.enderecos?.[0];
    return endereco ? `${endereco.cidade} / ${endereco.uf}` : "";
};

export default function Clientes() {
    const empresaId = obterEmpresaAtiva()?.id;
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [busca, setBusca] = useState("");
    const [campoBusca, setCampoBusca] = useState<CampoBuscaCliente | null>(null);
    const [situacao, setSituacao] = useState("ativos");
    const [pagina, setPagina] = useState(0);
    const [porPagina, setPorPagina] = useState(25);
    const [ordenacao, setOrdenacao] = useState<{ campo: string; direcao: "asc" | "desc" }>({ campo: "", direcao: "asc" });
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [mensagem, setMensagem] = useState("");
    const [edicao, setEdicao] = useState<Cliente | null | undefined>(undefined);
    const [abrindo, setAbrindo] = useState<number | null>(null);
    const [revisao, setRevisao] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        if (!empresaId) return;
        listarClientes(controller.signal)
            .then(setClientes)
            .catch((e) => {
                if (!controller.signal.aborted) setErro(mensagemCliente(e, "Não foi possível carregar os clientes."));
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [empresaId, revisao]);

    const filtrados = useMemo(() => clientes.map<ClienteTabela>((cliente) => ({
        ...cliente,
        cidadeUf: obterCidadeUf(cliente),
    })).filter((c) => {
        const termo = normalizar(busca.trim());
        const documento = busca.replace(/\D/g, "");
        let bate = !termo;
        if (termo && campoBusca === null) {
            bate = normalizar([c.id, c.nome, c.nomeFantasia, c.cpfCnpj].join(" ")).includes(termo)
                || (documento.length > 0 && (c.cpfCnpj ?? "").includes(documento));
        } else if (termo && campoBusca !== null) {
            const valor = String(c[campoBusca] ?? "");
            bate = normalizar(valor).includes(termo)
                || ((campoBusca === "cpfCnpj" || campoBusca === "telefone") && documento.length > 0 && valor.replace(/\D/g, "").includes(documento));
        }
        return (situacao === "todos" || c.ativo === (situacao === "ativos")) && bate;
    }).sort((a, b) => {
        if (!ordenacao.campo) return 0;
        const valorA = a[ordenacao.campo as keyof ClienteTabela];
        const valorB = b[ordenacao.campo as keyof ClienteTabela];
        if (valorA === valorB) return 0;
        if (valorA === null || valorA === undefined) return 1;
        if (valorB === null || valorB === undefined) return -1;
        const comparacao = valorA > valorB ? 1 : -1;
        return ordenacao.direcao === "asc" ? comparacao : -comparacao;
    }), [clientes, busca, campoBusca, ordenacao, situacao]);

    function selecionarCampoBusca(campo: string) {
        if (!(campo in camposBusca)) return;
        setCampoBusca(campo as CampoBuscaCliente);
        setPagina(0);
    }

    function removerCampoBusca() {
        setCampoBusca(null);
        setPagina(0);
    }

    async function abrir(c: Cliente) {
        if (!empresaId) return;
        setAbrindo(c.id);
        try {
            setEdicao(await buscarCliente(c.id));
        } catch (e) {
            setErro(mensagemCliente(e, "Não foi possível abrir o cliente."));
        } finally {
            setAbrindo(null);
        }
    }

    if (!empresaId) {
        return (
            <PageContainer>
                <PageHeader titulo="Clientes" descricao="Gerencie os clientes do seu negócio." />
                <Alert severity="warning">Selecione uma empresa para consultar os clientes.</Alert>
            </PageContainer>
        );
    }

    const renderNome = (valor: unknown, linha: ClienteTabela): React.ReactNode => (
        <Button sx={{ textTransform: "none", fontWeight: 600 }} disabled={abrindo !== null} onClick={() => void abrir(linha)}>
            {String(valor)}
        </Button>
    );

    const renderSimples = (valor: unknown): React.ReactNode => String(valor ?? "—");

    const renderCidadeUf = (valor: unknown): React.ReactNode => String(valor || "—");

    const renderSituacao = (valor: unknown): React.ReactNode => (
        <Chip size="small" color={valor ? "success" : "default"} variant="outlined" label={valor ? "Ativo" : "Inativo"} />
    );

    const colunas: Coluna<ClienteTabela>[] = [
        { campo: "id", cabecalho: "Código", largura: 100, pesquisavel: true, ordenavel: true },
        { campo: "nome", cabecalho: "Nome / Razão social", largura: 280, pesquisavel: true, ordenavel: true, render: renderNome },
        { campo: "nomeFantasia", cabecalho: "Nome fantasia", largura: 200, pesquisavel: true, ordenavel: true, render: renderSimples },
        { campo: "cpfCnpj", cabecalho: "CPF/CNPJ", largura: 180, pesquisavel: true, ordenavel: true, render: renderSimples },
        { campo: "cidadeUf", cabecalho: "Cidade / UF", largura: 200, pesquisavel: true, ordenavel: true, render: renderCidadeUf },
        { campo: "telefone", cabecalho: "Telefone", largura: 160, pesquisavel: true, ordenavel: true, render: renderSimples },
        { campo: "ativo", cabecalho: "Situação", largura: 120, ordenavel: true, render: renderSituacao },
    ];

    const acoes: AcaoTabela<ClienteTabela>[] = [
        {
            rotulo: "Editar",
            icone: <EditOutlinedIcon fontSize="small" />,
            onClick: abrir,
            desabilitado: () => abrindo !== null,
            tooltip: "Editar cliente",
        },
    ];

    const paginaAtual = Math.min(pagina, Math.max(0, Math.ceil(filtrados.length / porPagina) - 1));
    const linhasPagina = filtrados.slice(paginaAtual * porPagina, paginaAtual * porPagina + porPagina);

    return (
        <PageContainer>
            <PageHeader
                titulo="Clientes"
                descricao="Cadastros, contatos e condições comerciais em um só lugar."
                acaoPrincipal={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEdicao(null)}>Novo Cliente</Button>}
            />

            {erro && (
                <Alert severity="error" action={<Button color="inherit" onClick={() => { setErro(""); setCarregando(true); setRevisao((v) => v + 1); }}>Recarregar</Button>}>
                    {erro}
                </Alert>
            )}

            <Stack spacing={1}>
                <PageFilters
                    campoBuscaAtivo={campoBusca === null ? undefined : { rotulo: camposBusca[campoBusca].rotulo, onRemover: removerCampoBusca }}
                    busca={{
                        placeholder: campoBusca === null ? "Pesquisar por nome, razão social, CPF/CNPJ ou código…" : camposBusca[campoBusca].placeholder,
                        onChange: (v) => { setBusca(v); setPagina(0); },
                        valor: busca,
                    }}
                >
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel id="cliente-situacao-label">Situação</InputLabel>
                        <Select
                            labelId="cliente-situacao-label"
                            label="Situação"
                            value={situacao}
                            inputProps={{ "aria-label": "Filtrar clientes por situação", name: "situacao" }}
                            onChange={(e) => { setSituacao(e.target.value); setPagina(0); }}
                        >
                            <MenuItem value="todos">Todas</MenuItem>
                            <MenuItem value="ativos">Ativos</MenuItem>
                            <MenuItem value="inativos">Inativos</MenuItem>
                        </Select>
                    </FormControl>
                </PageFilters>

                <AppTable
                    colunas={colunas}
                    buscaPorColuna={{ campo: campoBusca, onSelecionar: selecionarCampoBusca }}
                    linhas={linhasPagina}
                    carregando={carregando}
                    obterChaveLinha={(c) => c.id}
                    vazio={{
                        titulo: busca || situacao !== "todos" ? "Nenhum cliente encontrado para os filtros selecionados." : "Nenhum cliente cadastrado",
                        descricao: busca || situacao !== "todos" ? "Tente ajustar os filtros." : "Comece em Novo Cliente.",
                    }}
                    acoes={acoes}
                    ordenacao={{
                        campo: ordenacao.campo,
                        direcao: ordenacao.direcao,
                        onSort: (campo) => setOrdenacao((atual) => ({
                            campo,
                            direcao: atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc",
                        })),
                    }}
                    paginacao={{
                        pagina: paginaAtual,
                        linhasPorPagina: porPagina,
                        total: filtrados.length,
                        onPageChange: setPagina,
                        onRowsPerPageChange: (valor) => { setPorPagina(valor); setPagina(0); },
                        opcoesLinhasPorPagina: [10, 25, 50],
                    }}
                    alturaCorpo={480}
                    minWidth={1000}
                />
            </Stack>

            {edicao !== undefined && (
                <ClienteForm
                    key={edicao?.id ?? "novo"}
                    cliente={edicao}
                    onFechar={() => setEdicao(undefined)}
                    onSalvo={(c) => {
                        setClientes((lista) => [...lista.filter((x) => x.id !== c.id), c].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
                        setEdicao(undefined);
                        setMensagem("Cliente salvo com sucesso.");
                    }}
                />
            )}

            <Snackbar open={!!mensagem} autoHideDuration={5000} onClose={() => setMensagem("")} message={mensagem} />
        </PageContainer>
    );
}
