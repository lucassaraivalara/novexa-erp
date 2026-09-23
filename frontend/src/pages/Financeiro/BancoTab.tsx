import { useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { Alert, Button, Chip, FormControl, MenuItem, Select, Snackbar, Stack } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageFilters from "../../components/ui/PageFilters";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import { listarBancos, mensagemDadosBancarios, salvarBanco } from "../../services/dadosBancariosService";
import type { BancoResumo } from "../../types/dadosBancarios";
import BancoForm from "./BancoForm";

const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function BancoTab() {
    const [bancos, setBancos] = useState<BancoResumo[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [busca, setBusca] = useState("");
    const [situacao, setSituacao] = useState("ativos");
    const [editor, setEditor] = useState<{ banco: BancoResumo | null } | null>(null);
    const [alternando, setAlternando] = useState<number | null>(null);
    const [sucesso, setSucesso] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        listarBancos(controller.signal)
            .then(setBancos)
            .catch((e) => {
                if (!controller.signal.aborted) setErro(mensagemDadosBancarios(e, "Não foi possível carregar os bancos."));
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [tentativa]);

    const filtrados = useMemo(() => {
        const termo = normalizar(busca.trim());
        return bancos.filter((b) =>
            (!termo || normalizar(`${b.numero} ${b.nome}`).includes(termo)) &&
            (situacao === "todos" || b.ativo === (situacao === "ativos")));
    }, [bancos, busca, situacao]);

    async function alternarSituacao(banco: BancoResumo) {
        setAlternando(banco.id);
        setErro("");
        try {
            const salvo = await salvarBanco({ numero: banco.numero, nome: banco.nome, cnab: banco.cnab, ativo: !banco.ativo }, banco.id);
            setBancos((atuais) => atuais.map((b) => (b.id === salvo.id ? salvo : b)));
            setSucesso(true);
        } catch (e) {
            setErro(mensagemDadosBancarios(e, "Não foi possível alterar a situação do banco."));
        } finally {
            setAlternando(null);
        }
    }

    function salvo(banco: BancoResumo) {
        setBancos((atuais) => atuais.some((b) => b.id === banco.id) ? atuais.map((b) => (b.id === banco.id ? banco : b)) : [...atuais, banco]);
        setEditor(null);
        setSucesso(true);
    }

    const colunas: Coluna<BancoResumo>[] = [
        { campo: "id", cabecalho: "Código", largura: 90 },
        { campo: "numero", cabecalho: "Número", largura: 100 },
        { campo: "nome", cabecalho: "Nome", largura: 280 },
        { campo: "cnab", cabecalho: "CNAB", largura: 100, render: (valor) => String(valor ?? "—") },
        {
            campo: "ativo", cabecalho: "Situação", largura: 110,
            render: (valor) => <Chip size="small" label={valor ? "Ativo" : "Inativo"} color={valor ? "success" : "default"} variant={valor ? "filled" : "outlined"} />,
        },
    ];

    const acoes: AcaoTabela<BancoResumo>[] = [
        { rotulo: "Editar", icone: <EditOutlinedIcon fontSize="small" />, onClick: (b) => setEditor({ banco: b }), tooltip: "Editar banco" },
        {
            rotulo: "Inativar", icone: <BlockRoundedIcon fontSize="small" />, onClick: (b) => void alternarSituacao(b),
            desabilitado: () => alternando !== null, cor: "error", tooltip: "Ativar ou inativar banco",
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
                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEditor({ banco: null })}>Novo Banco</Button>
            </Stack>

            <Stack spacing={1}>
                <PageFilters busca={{ placeholder: "Pesquisar por número ou nome", valor: busca, onChange: setBusca }}>
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <Select value={situacao} inputProps={{ "aria-label": "Filtrar bancos por situação" }} onChange={(e) => setSituacao(e.target.value)}>
                            <MenuItem value="todos">Todos</MenuItem>
                            <MenuItem value="ativos">Ativos</MenuItem>
                            <MenuItem value="inativos">Inativos</MenuItem>
                        </Select>
                    </FormControl>
                </PageFilters>

                <AppTable
                    colunas={colunas}
                    linhas={filtrados}
                    carregando={carregando}
                    obterChaveLinha={(b) => b.id}
                    vazio={{
                        titulo: "Nenhum banco encontrado",
                        descricao: busca || situacao !== "todos" ? "Tente ajustar os filtros." : "Cadastre o primeiro banco para começar.",
                    }}
                    acoes={acoes}
                    minWidth={760}
                />
            </Stack>

            {editor && <BancoForm banco={editor.banco} onFechar={() => setEditor(null)} onSalvo={salvo} />}

            <Snackbar open={sucesso} autoHideDuration={4500} onClose={() => setSucesso(false)}>
                <Alert severity="success" onClose={() => setSucesso(false)}>Banco salvo com sucesso.</Alert>
            </Snackbar>
        </PageContainer>
    );
}
