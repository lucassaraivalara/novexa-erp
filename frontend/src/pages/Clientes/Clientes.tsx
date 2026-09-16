import { useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
    Alert, Button, Chip, MenuItem, Snackbar,
    FormControl, Select, Stack,
} from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type Coluna, type AcaoTabela } from "../../components/ui/AppTable";
import PageFilters from "../../components/ui/PageFilters";
import { buscarCliente, listarClientes, mensagemCliente } from "../../services/clienteService";
import type { Cliente } from "../../types/cliente";
import { obterEmpresaAtiva } from "../../utils/auth/sessao";
import ClienteForm from "./ClienteForm";

const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function Clientes() {
    const empresaId = obterEmpresaAtiva()?.id;
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [busca, setBusca] = useState("");
    const [situacao, setSituacao] = useState("todos");
    const [pagina, setPagina] = useState(0);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [mensagem, setMensagem] = useState("");
    const [edicao, setEdicao] = useState<Cliente | null | undefined>(undefined);
    const [abrindo, setAbrindo] = useState<number | null>(null);
    const [revisao, setRevisao] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        if (!empresaId) return;
        listarClientes(empresaId, controller.signal)
            .then(setClientes)
            .catch((e) => {
                if (!controller.signal.aborted) setErro(mensagemCliente(e, "Não foi possível carregar os clientes."));
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [empresaId, revisao]);

    const filtrados = useMemo(() => clientes.filter((c) => {
        const termo = normalizar(busca.trim());
        const documento = busca.replace(/\D/g, "");
        const bate = !termo || normalizar([c.id, c.nome, c.nomeFantasia, c.cpfCnpj].join(" ")).includes(termo) || (documento.length > 0 && (c.cpfCnpj ?? "").includes(documento));
        return (situacao === "todos" || c.ativo === (situacao === "ativos")) && bate;
    }), [clientes, busca, situacao]);

    async function abrir(c: Cliente) {
        if (!empresaId) return;
        setAbrindo(c.id);
        try {
            setEdicao(await buscarCliente(c.id, empresaId));
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

    const renderNome = (valor: unknown, linha: Cliente): React.ReactNode => (
        <Button sx={{ textTransform: "none", fontWeight: 600 }} disabled={abrindo !== null} onClick={() => void abrir(linha)}>
            {String(valor)}
        </Button>
    );

    const renderSimples = (valor: unknown): React.ReactNode => String(valor ?? "—");

    const renderCidadeUf = (_: unknown, linha: Cliente): React.ReactNode => {
        const e = linha.enderecos?.find((x) => x.principal) ?? linha.enderecos?.[0];
        return e ? `${e.cidade} / ${e.uf}` : "—";
    };

    const renderSituacao = (valor: unknown): React.ReactNode => (
        <Chip size="small" color={valor ? "success" : "default"} variant="outlined" label={valor ? "Ativo" : "Inativo"} />
    );

    const colunas: Coluna<Cliente>[] = [
        { campo: "id", cabecalho: "Código", largura: 100 },
        { campo: "nome", cabecalho: "Nome / Razão social", largura: 280, render: renderNome },
        { campo: "nomeFantasia", cabecalho: "Nome fantasia", largura: 200, render: renderSimples },
        { campo: "cpfCnpj", cabecalho: "CPF/CNPJ", largura: 180, render: renderSimples },
        { campo: "enderecos", cabecalho: "Cidade / UF", largura: 200, render: renderCidadeUf },
        { campo: "telefone", cabecalho: "Telefone", largura: 160, render: renderSimples },
        { campo: "ativo", cabecalho: "Situação", largura: 120, render: renderSituacao },
    ];

    const acoes: AcaoTabela<Cliente>[] = [
        {
            rotulo: "Editar",
            icone: <EditOutlinedIcon fontSize="small" />,
            onClick: abrir,
            desabilitado: () => abrindo !== null,
            tooltip: "Editar cliente",
        },
    ];

    const paginaAtual = Math.min(pagina, Math.max(0, Math.ceil(filtrados.length / 10) - 1));
    const linhasPagina = filtrados.slice(paginaAtual * 10, paginaAtual * 10 + 10);

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
                    busca={{
                        placeholder: "Nome, razão social, CPF/CNPJ ou código",
                        onChange: (v) => { setBusca(v); setPagina(0); },
                        valor: busca,
                    }}
                >
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <Select label="Situação" value={situacao} onChange={(e) => { setSituacao(e.target.value); setPagina(0); }}>
                            <MenuItem value="todos">Todas</MenuItem>
                            <MenuItem value="ativos">Ativos</MenuItem>
                            <MenuItem value="inativos">Inativos</MenuItem>
                        </Select>
                    </FormControl>
                </PageFilters>

                <AppTable
                    colunas={colunas}
                    linhas={linhasPagina}
                    carregando={carregando}
                    obterChaveLinha={(c) => c.id}
                    vazio={{
                        titulo: busca || situacao !== "todos" ? "Nenhum cliente encontrado para os filtros selecionados." : "Nenhum cliente cadastrado",
                        descricao: busca || situacao !== "todos" ? "Tente ajustar os filtros." : "Comece em Novo Cliente.",
                    }}
                    acoes={acoes}
                    paginacao={{
                        pagina: paginaAtual,
                        linhasPorPagina: 10,
                        total: filtrados.length,
                        onPageChange: setPagina,
                        onRowsPerPageChange: () => {},
                        opcoesLinhasPorPagina: [10],
                    }}
                    minWidth={1000}
                />
            </Stack>

            {edicao !== undefined && (
                <ClienteForm
                    key={edicao?.id ?? "novo"}
                    cliente={edicao}
                    empresaId={empresaId}
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
