import { useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { Alert, Button, Chip, FormControl, MenuItem, Select, Snackbar, Stack } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageFilters from "../../components/ui/PageFilters";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import { listarContasBancarias, mensagemDadosBancarios, salvarContaBancaria } from "../../services/dadosBancariosService";
import type { ContaBancariaResumo } from "../../types/dadosBancarios";
import ContaBancariaForm from "./ContaBancariaForm";

const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const rotulosTipo: Record<string, string> = { CORRENTE: "Corrente", POUPANCA: "Poupança" };

export default function ContaBancariaTab() {
    const [contas, setContas] = useState<ContaBancariaResumo[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [busca, setBusca] = useState("");
    const [banco, setBanco] = useState("todos");
    const [agencia, setAgencia] = useState("todas");
    const [tipo, setTipo] = useState("todos");
    const [situacao, setSituacao] = useState("ativos");
    const [editor, setEditor] = useState<{ conta: ContaBancariaResumo | null } | null>(null);
    const [alternando, setAlternando] = useState<number | null>(null);
    const [sucesso, setSucesso] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        listarContasBancarias(undefined, controller.signal)
            .then(setContas)
            .catch((e) => {
                if (!controller.signal.aborted) setErro(mensagemDadosBancarios(e, "Não foi possível carregar as contas bancárias."));
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [tentativa]);

    const bancosDisponiveis = useMemo(() => {
        const mapa = new Map<number, string>();
        contas.forEach((c) => mapa.set(c.bancoId, c.bancoNome));
        return Array.from(mapa.entries());
    }, [contas]);

    const agenciasDisponiveis = useMemo(() => {
        const mapa = new Map<number, { bancoId: number; label: string }>();
        contas.forEach((c) => mapa.set(c.agenciaId, {
            bancoId: c.bancoId,
            label: `${c.bancoNome} — ${c.agenciaNumero}${c.agenciaDigito ? `-${c.agenciaDigito}` : ""}`,
        }));
        return Array.from(mapa.entries()).filter(([, item]) => banco === "todos" || item.bancoId === Number(banco));
    }, [contas, banco]);

    const filtradas = useMemo(() => {
        const termo = normalizar(busca.trim());
        return contas.filter((c) =>
            (!termo || normalizar(`${c.numero} ${c.titular ?? ""} ${c.bancoNome} ${c.agenciaNumero}`).includes(termo)) &&
            (banco === "todos" || c.bancoId === Number(banco)) &&
            (agencia === "todas" || c.agenciaId === Number(agencia)) &&
            (tipo === "todos" || c.tipo === tipo) &&
            (situacao === "todos" || c.ativo === (situacao === "ativos")));
    }, [contas, busca, banco, agencia, tipo, situacao]);

    async function alternarSituacao(conta: ContaBancariaResumo) {
        setAlternando(conta.id);
        setErro("");
        try {
            const salva = await salvarContaBancaria({
                agenciaId: conta.agenciaId, numero: conta.numero, digito: conta.digito,
                titular: conta.titular, tipo: conta.tipo, ativo: !conta.ativo,
            }, conta.id);
            setContas((atuais) => atuais.map((c) => (c.id === salva.id ? salva : c)));
            setSucesso(true);
        } catch (e) {
            setErro(mensagemDadosBancarios(e, "Não foi possível alterar a situação da conta."));
        } finally {
            setAlternando(null);
        }
    }

    function salva(conta: ContaBancariaResumo) {
        setContas((atuais) => atuais.some((c) => c.id === conta.id) ? atuais.map((c) => (c.id === conta.id ? conta : c)) : [...atuais, conta]);
        setEditor(null);
        setSucesso(true);
    }

    const colunas: Coluna<ContaBancariaResumo>[] = [
        { campo: "id", cabecalho: "Código", largura: 90 },
        { campo: "bancoNome", cabecalho: "Banco", largura: 200 },
        {
            campo: "agenciaNumero", cabecalho: "Agência", largura: 110,
            render: (valor, linha) => `${String(valor)}${linha.agenciaDigito ? `-${linha.agenciaDigito}` : ""}`,
        },
        {
            campo: "numero", cabecalho: "Conta", largura: 130,
            render: (valor, linha) => `${String(valor)}${linha.digito ? `-${linha.digito}` : ""}`,
        },
        { campo: "titular", cabecalho: "Titular", largura: 220, render: (valor) => String(valor ?? "—") },
        { campo: "tipo", cabecalho: "Tipo", largura: 120, render: (valor) => rotulosTipo[String(valor)] ?? String(valor) },
        {
            campo: "ativo", cabecalho: "Situação", largura: 110,
            render: (valor) => <Chip size="small" label={valor ? "Ativo" : "Inativo"} color={valor ? "success" : "default"} variant={valor ? "filled" : "outlined"} />,
        },
    ];

    const acoes: AcaoTabela<ContaBancariaResumo>[] = [
        { rotulo: "Editar", icone: <EditOutlinedIcon fontSize="small" />, onClick: (c) => setEditor({ conta: c }), tooltip: "Editar conta bancária" },
        {
            rotulo: "Inativar", icone: <BlockRoundedIcon fontSize="small" />, onClick: (c) => void alternarSituacao(c),
            desabilitado: () => alternando !== null, cor: "error", tooltip: "Ativar ou inativar conta",
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
                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEditor({ conta: null })}>Nova Conta</Button>
            </Stack>

            <Stack spacing={1}>
                <PageFilters busca={{ placeholder: "Pesquisar por conta ou titular", valor: busca, onChange: setBusca }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <Select value={banco} onChange={(e) => setBanco(e.target.value)}>
                            <MenuItem value="todos">Todos os bancos</MenuItem>
                            {bancosDisponiveis.map(([id, nome]) => <MenuItem key={id} value={String(id)}>{nome}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 230 }}>
                        <Select value={agencia} onChange={(e) => setAgencia(e.target.value)}>
                            <MenuItem value="todas">Todas as agências</MenuItem>
                            {agenciasDisponiveis.map(([id, item]) => <MenuItem key={id} value={String(id)}>{item.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                            <MenuItem value="todos">Todos os tipos</MenuItem>
                            <MenuItem value="CORRENTE">Corrente</MenuItem>
                            <MenuItem value="POUPANCA">Poupança</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <Select value={situacao} inputProps={{ "aria-label": "Filtrar contas bancárias por situação" }} onChange={(e) => setSituacao(e.target.value)}>
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
                    obterChaveLinha={(c) => c.id}
                    vazio={{
                        titulo: "Nenhuma conta bancária encontrada",
                        descricao: busca || banco !== "todos" || agencia !== "todas" || tipo !== "todos" || situacao !== "todos" ? "Tente ajustar os filtros." : "Cadastre a primeira conta para começar.",
                    }}
                    acoes={acoes}
                    minWidth={1000}
                />
            </Stack>

            {editor && <ContaBancariaForm conta={editor.conta} onFechar={() => setEditor(null)} onSalvo={salva} />}

            <Snackbar open={sucesso} autoHideDuration={4500} onClose={() => setSucesso(false)}>
                <Alert severity="success" onClose={() => setSucesso(false)}>Conta bancária salva com sucesso.</Alert>
            </Snackbar>
        </PageContainer>
    );
}
