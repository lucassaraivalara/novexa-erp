import { useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { Alert, Button, Chip, FormControl, InputLabel, MenuItem, Select, Snackbar } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import { listarFormasPagamento, mensagemFormaPagamento } from "../../services/formaPagamentoService";
import type { FormaPagamentoResumo } from "../../types/formaPagamento";
import FormaPagamentoForm from "./FormaPagamentoForm";

const colunas: Coluna<FormaPagamentoResumo>[] = [
    { campo: "descricao", cabecalho: "Descrição", largura: 360 },
    { campo: "tipo", cabecalho: "Tipo", largura: 220 },
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
    const [formas, setFormas] = useState<FormaPagamentoResumo[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [situacao, setSituacao] = useState("ativas");
    const [editor, setEditor] = useState<{ forma: FormaPagamentoResumo | null } | null>(null);
    const [sucesso, setSucesso] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        listarFormasPagamento(controller.signal)
            .then(setFormas)
            .catch((e) => {
                if (!controller.signal.aborted) setErro(mensagemFormaPagamento(e, "Não foi possível carregar as formas de pagamento."));
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [tentativa]);

    const acoes: AcaoTabela<FormaPagamentoResumo>[] = [{
        rotulo: "Editar",
        icone: <EditOutlinedIcon fontSize="small" />,
        onClick: (forma) => setEditor({ forma }),
        tooltip: "Editar forma de pagamento",
    }];

    function salvo(forma: FormaPagamentoResumo) {
        setFormas((atuais) => atuais.some((atual) => atual.id === forma.id)
            ? atuais.map((atual) => atual.id === forma.id ? forma : atual)
            : [...atuais, forma]);
        setEditor(null);
        setSucesso(true);
    }

    const formasFiltradas = formas.filter((forma) =>
        situacao === "todas" || forma.ativo === (situacao === "ativas"));

    return (
        <PageContainer>
            <PageHeader
                titulo="Formas de Pagamento"
                descricao="Consulte as formas de pagamento disponíveis no sistema."
                acaoPrincipal={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEditor({ forma: null })}>Nova Forma de Pagamento</Button>}
            />

            {erro && (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => { setErro(""); setCarregando(true); setTentativa((valor) => valor + 1); }}>Tentar novamente</Button>}>
                    {erro}
                </Alert>
            )}

            <AppTable
                colunas={colunas}
                linhas={formasFiltradas}
                carregando={carregando}
                obterChaveLinha={(forma) => forma.id}
                filtros={
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel id="forma-pagamento-situacao-label">Situação</InputLabel>
                        <Select
                            labelId="forma-pagamento-situacao-label"
                            label="Situação"
                            value={situacao}
                            inputProps={{ "aria-label": "Filtrar formas de pagamento por situação", name: "situacao" }}
                            onChange={(evento) => setSituacao(evento.target.value)}
                        >
                            <MenuItem value="todas">Todas</MenuItem>
                            <MenuItem value="ativas">Ativas</MenuItem>
                            <MenuItem value="inativas">Inativas</MenuItem>
                        </Select>
                    </FormControl>
                }
                vazio={{
                    titulo: "Nenhuma forma de pagamento encontrada",
                    descricao: erro ? "Listagem indisponível." : situacao !== "todas" ? "Tente ajustar o filtro de situação." : "Não há formas de pagamento cadastradas.",
                }}
                acoes={acoes}
                minWidth={760}
            />

            {editor && <FormaPagamentoForm forma={editor.forma} onFechar={() => setEditor(null)} onSalvo={salvo} />}

            <Snackbar open={sucesso} autoHideDuration={5000} onClose={() => setSucesso(false)}>
                <Alert severity="success" onClose={() => setSucesso(false)}>Forma de pagamento salva com sucesso.</Alert>
            </Snackbar>
        </PageContainer>
    );
}
