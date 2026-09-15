import { useEffect, useState } from "react";
import { Alert, Button, Chip, Stack } from "@mui/material";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type Coluna } from "../../components/ui/AppTable";
import { listarFormasPagamento, mensagemFormaPagamento } from "../../services/formaPagamentoService";
import type { FormaPagamentoResumo } from "../../types/formaPagamento";

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
    }, []);

    function recarregar() {
        window.location.reload();
    }

    return (
        <Stack spacing={2.5}>
            <PageHeader
                titulo="Formas de Pagamento"
                descricao="Consulte as formas de pagamento disponíveis para a empresa."
            />

            {erro && (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={recarregar}>Tentar novamente</Button>}>
                    {erro}
                </Alert>
            )}

            <AppTable
                colunas={colunas}
                linhas={formas}
                carregando={carregando}
                obterChaveLinha={(forma) => forma.id}
                vazio={{
                    titulo: "Nenhuma forma de pagamento encontrada",
                    descricao: erro ? "Listagem indisponível." : "Não há formas de pagamento cadastradas.",
                }}
                minWidth={760}
            />
        </Stack>
    );
}
