import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    Chip,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import LoadingState from "../../components/ui/LoadingState";
import { buscarResumoDashboard, mensagemDashboard, type DashboardResumo } from "../../services/dashboardService";
import { listarVendas, type VendaResumo } from "../../services/vendaService";
import { dataHoraVenda, moedaVenda, rotulosStatus } from "../Vendas/centralVendasUtils";

const corStatus = (status: VendaResumo["status"]) =>
    status === "FATURADA" ? "success" : status === "CANCELADA" ? "default" : "warning";

export default function Dashboard() {
    const [resumo, setResumo] = useState<DashboardResumo | null>(null);
    const [ultimasVendas, setUltimasVendas] = useState<VendaResumo[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [erroVendas, setErroVendas] = useState("");

    const carregar = useCallback(async (signal?: AbortSignal) => {
        setCarregando(true);
        setErro("");
        setErroVendas("");
        try {
            const dadosResumo = await buscarResumoDashboard(signal);
            setResumo(dadosResumo);
        } catch (e) {
            if (!signal?.aborted) setErro(mensagemDashboard(e));
            return;
        } finally {
            if (!signal?.aborted) setCarregando(false);
        }

        try {
            const vendas = await listarVendas({}, signal);
            setUltimasVendas(vendas.slice(0, 5));
        } catch {
            if (!signal?.aborted) setErroVendas("Não foi possível carregar as últimas vendas.");
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void carregar(controller.signal);
        return () => controller.abort();
    }, [carregar]);

    return <Stack spacing={2.5}>
        <PageHeader titulo="Dashboard" descricao="Resumo operacional de hoje." />

        {erro && <Alert severity="error" action={<Button color="inherit" onClick={() => void carregar()}>Tentar novamente</Button>}>{erro}</Alert>}

        {carregando && !resumo ? <Paper variant="outlined"><LoadingState mensagem="Carregando resumo operacional…" /></Paper> : resumo && <>
            <Box sx={{ display: "grid", gap: 2,
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)", xl: "repeat(5, 1fr)" } }}>
                <StatCard titulo="Faturamento hoje" valor={moedaVenda(resumo.faturamentoHoje)} descricao="Vendas faturadas" cor="success" />
                <StatCard titulo="Vendas hoje" valor={resumo.quantidadeVendasHoje} descricao="Vendas faturadas" cor="primary" />
                <StatCard titulo="Ticket médio hoje" valor={moedaVenda(resumo.ticketMedioHoje)} descricao="Média por venda" cor="info" />
                <StatCard titulo="Estoque baixo" valor={resumo.quantidadeProdutosEstoqueBaixo} descricao="Produtos no mínimo ou abaixo" cor="warning" />
                <StatCard titulo="Clientes ativos" valor={resumo.quantidadeClientesAtivos} descricao="Cadastros disponíveis" cor="primary" />
            </Box>

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Caixa operacional</Typography>
                    {resumo.sessoesCaixaAbertas.length > 1
                        && <Chip size="small" variant="outlined" color="success"
                            label={`${resumo.sessoesCaixaAbertas.length} sessões abertas`} />}
                </Stack>
                {resumo.sessoesCaixaAbertas.length === 0 ? <Stack direction="row"
                    sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                    <Typography color="text.secondary">Nenhum caixa aberto</Typography>
                    <Stack direction="row" spacing={1}>
                        <Button size="small" component={Link} to="/financeiro/caixas">Ir para Caixas</Button>
                        <Button size="small" component={Link} to="/pdv">Abrir PDV</Button>
                    </Stack>
                </Stack> : <Table size="small" aria-label="Sessões de caixa abertas">
                    <TableHead><TableRow><TableCell>Caixa</TableCell><TableCell align="right">Saldo inicial</TableCell>
                        <TableCell align="right">Saldo esperado em dinheiro</TableCell></TableRow></TableHead>
                    <TableBody>{resumo.sessoesCaixaAbertas.map(sessao => <TableRow key={sessao.sessaoId}>
                        <TableCell>{sessao.descricaoCaixa}</TableCell>
                        <TableCell align="right">{moedaVenda(sessao.saldoInicial)}</TableCell>
                        <TableCell align="right"><strong>{moedaVenda(sessao.saldoEsperadoDinheiro)}</strong></TableCell>
                    </TableRow>)}</TableBody>
                </Table>}
            </Paper>

            <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Últimas vendas</Typography>
                    <Button size="small" component={Link} to="/vendas">Ver todas</Button>
                </Stack>
                {erroVendas ? <Alert severity="warning" sx={{ mx: 2, mb: 1.5 }}>{erroVendas}</Alert>
                    : ultimasVendas.length === 0
                    ? <Typography color="text.secondary" sx={{ px: 2, pb: 2 }}>Nenhuma venda registrada.</Typography>
                    : <Table size="small" aria-label="Últimas vendas">
                        <TableHead><TableRow><TableCell>Venda</TableCell><TableCell>Data / hora</TableCell>
                            <TableCell>Cliente</TableCell><TableCell align="right">Total</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                        <TableBody>{ultimasVendas.map(venda => <TableRow key={venda.id}>
                            <TableCell>#{venda.id}</TableCell>
                            <TableCell>{dataHoraVenda(venda.dataHora)}</TableCell>
                            <TableCell>{venda.nomeCliente || "Consumidor final"}</TableCell>
                            <TableCell align="right">{moedaVenda(venda.total)}</TableCell>
                            <TableCell><Chip size="small" variant="outlined" color={corStatus(venda.status)}
                                label={rotulosStatus[venda.status]} /></TableCell>
                        </TableRow>)}</TableBody>
                    </Table>}
            </Paper>
        </>}
    </Stack>;
}
