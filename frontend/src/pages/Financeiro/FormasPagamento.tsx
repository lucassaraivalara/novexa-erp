import { useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { Alert, Button, Chip, FormControl, InputLabel, MenuItem, Select, Snackbar } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import { listarConfiguracoesFormasPagamento, mensagemConfiguracaoFormaPagamento } from "../../services/configuracaoFormaPagamentoService";
import type { ConfiguracaoFormaPagamento } from "../../types/configuracaoFormaPagamento";
import { rotulosTipoFormaPagamento } from "../../types/configuracaoFormaPagamento";
import ConfiguracaoFormaPagamentoForm from "./ConfiguracaoFormaPagamentoForm";

const colunas: Coluna<ConfiguracaoFormaPagamento>[] = [
    { campo: "nomeExibicao", cabecalho: "Nome", largura: 280 },
    {
        campo: "tipo",
        cabecalho: "Tipo",
        largura: 160,
        render: (valor) => rotulosTipoFormaPagamento[valor as keyof typeof rotulosTipoFormaPagamento] ?? valor,
    },
    {
        campo: "contaFinanceiraDestino",
        cabecalho: "Conta destino",
        largura: 220,
        render: (_valor, linha) => linha.contaFinanceiraDestino ? `${linha.contaFinanceiraDestino.nome} — ${linha.contaFinanceiraDestino.tipo}`
            : ["DEBITO", "CREDITO"].includes(linha.tipo) ? "Pendente de regularização" : "—",
    },
    {
        campo: "ativo",
        cabecalho: "Situação",
        largura: 120,
        render: (valor) => (
            <Chip
                size="small"
                label={valor ? "Ativa" : "Inativa"}
                color={valor ? "success" : "default"}
                variant={valor ? "filled" : "outlined"}
            />
        ),
    },
];

export default function FormasPagamento() {
    const [configuracoes, setConfiguracoes] = useState<ConfiguracaoFormaPagamento[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [situacao, setSituacao] = useState<"ativas" | "inativas" | "todas">("ativas");
    const [editor, setEditor] = useState<{ config: ConfiguracaoFormaPagamento | null } | null>(null);
    const [sucesso, setSucesso] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        listarConfiguracoesFormasPagamento(situacao, controller.signal)
            .then(setConfiguracoes)
            .catch((e) => {
                if (!controller.signal.aborted) setErro(mensagemConfiguracaoFormaPagamento(e, "Não foi possível carregar as configurações de pagamento."));
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [tentativa, situacao]);

    const acoes: AcaoTabela<ConfiguracaoFormaPagamento>[] = [{
        rotulo: "Editar",
        icone: <EditOutlinedIcon fontSize="small" />,
        onClick: (config) => setEditor({ config }),
        tooltip: "Editar configuração de pagamento",
    }];

    function salvo(config: ConfiguracaoFormaPagamento) {
        setConfiguracoes((atuais) => atuais.some((atual) => atual.id === config.id)
            ? atuais.map((atual) => atual.id === config.id ? config : atual)
            : [...atuais, config]);
        setEditor(null);
        setSucesso(true);
    }

    return (
        <PageContainer>
            <PageHeader
                titulo="Configurações de Pagamento"
                descricao="Configure as formas de pagamento da sua empresa."
                acaoPrincipal={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEditor({ config: null })}>Nova Configuração</Button>}
            />

            {erro && (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => { setErro(""); setCarregando(true); setTentativa((valor) => valor + 1); }}>Tentar novamente</Button>}>
                    {erro}
                </Alert>
            )}

            <AppTable
                colunas={colunas}
                linhas={configuracoes}
                carregando={carregando}
                obterChaveLinha={(config) => config.id}
                filtros={
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel id="config-pagamento-situacao-label">Situação</InputLabel>
                        <Select
                            labelId="config-pagamento-situacao-label"
                            label="Situação"
                            value={situacao}
                            inputProps={{ "aria-label": "Filtrar configurações por situação", name: "situacao" }}
                            onChange={(evento) => setSituacao(evento.target.value as "ativas" | "inativas" | "todas")}
                        >
                            <MenuItem value="todas">Todas</MenuItem>
                            <MenuItem value="ativas">Ativas</MenuItem>
                            <MenuItem value="inativas">Inativas</MenuItem>
                        </Select>
                    </FormControl>
                }
                vazio={{
                    titulo: "Nenhuma configuração encontrada",
                    descricao: erro ? "Listagem indisponível." : situacao !== "todas" ? "Tente ajustar o filtro de situação." : "Não há configurações de pagamento cadastradas.",
                }}
                acoes={acoes}
                minWidth={880}
            />

            {editor && <ConfiguracaoFormaPagamentoForm config={editor.config} onFechar={() => setEditor(null)} onSalvo={salvo} />}

            <Snackbar open={sucesso} autoHideDuration={5000} onClose={() => setSucesso(false)}>
                <Alert severity="success" onClose={() => setSucesso(false)}>Configuração salva com sucesso.</Alert>
            </Snackbar>
        </PageContainer>
    );
}
