import { Box, Paper, Stack, Typography } from "@mui/material";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";

function PlaceholderCard({ titulo, descricao, icone }: { titulo: string; descricao: string; icone: React.ReactNode }) {
    return (
        <Paper variant="outlined" sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", minHeight: 160 }}>
            <Box sx={{ mb: 2, opacity: 0.3, color: "text.secondary" }}>{icone}</Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                {titulo}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
                {descricao}
            </Typography>
        </Paper>
    );
}

function Dashboard() {
    return (
        <Stack spacing={2.5}>
            <PageHeader
                titulo="Dashboard"
                descricao="Visão geral do desempenho do seu negócio."
            />

            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" } }}>
                <StatCard titulo="Faturamento do mês" valor="R$ 0,00" descricao="Vendas concluídas" cor="success" />
                <StatCard titulo="Vendas hoje" valor="0" descricao="Transações realizadas" cor="primary" />
                <StatCard titulo="Produtos em estoque" valor="0" descricao="Itens cadastrados" cor="info" />
                <StatCard titulo="Clientes ativos" valor="0" descricao="Cadastros ativos" cor="warning" />
            </Box>

            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" } }}>
                <PlaceholderCard
                    titulo="Faturamento por período"
                    descricao="Gráfico de evolução do faturamento diário/semanal/mensal. Será implementado com dados reais do backend."
                    icone={<span style={{ fontSize: 48 }}>📈</span>}
                />
                <PlaceholderCard
                    titulo="Top produtos vendidos"
                    descricao="Ranking dos produtos mais vendidos no período. Será implementado com dados reais do backend."
                    icone={<span style={{ fontSize: 48 }}>🏆</span>}
                />
                <PlaceholderCard
                    titulo="Estoque crítico"
                    descricao="Produtos com estoque abaixo do mínimo. Será implementado com dados reais do backend."
                    icone={<span style={{ fontSize: 48 }}>⚠️</span>}
                />
                <PlaceholderCard
                    titulo="Contas a receber / pagar"
                    descricao="Resumo financeiro de recebíveis e pagáveis. Será implementado com dados reais do backend."
                    icone={<span style={{ fontSize: 48 }}>💰</span>}
                />
            </Box>

            <Paper variant="outlined" sx={{ p: 3, mt: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                    Próximos passos
                </Typography>
                <Stack sx={{ gap: 1.5 }}>
                    <Typography color="text.secondary" sx={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
                        <strong>1.</strong> Cadastre sua empresa em <strong>Administração → Empresas</strong> com dados fiscais completos.
                    </Typography>
                    <Typography color="text.secondary" sx={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
                        <strong>2.</strong> Cadastre produtos em <strong>Produtos</strong> com preços, códigos de barras e controle de estoque.
                    </Typography>
                    <Typography color="text.secondary" sx={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
                        <strong>3.</strong> Cadastre clientes em <strong>Clientes</strong> para agilizar vendas a prazo e emissão de documentos.
                    </Typography>
                    <Typography color="text.secondary" sx={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
                        <strong>4.</strong> Configure <strong>Estoque</strong> e <strong>Vendas/PDV</strong> (em desenvolvimento) para operação completa.
                    </Typography>
                </Stack>
            </Paper>
        </Stack>
    );
}

export default Dashboard;