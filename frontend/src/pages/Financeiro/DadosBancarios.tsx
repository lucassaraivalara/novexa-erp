import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import { Box, Paper, Tab, Tabs } from "@mui/material";
import { useState } from "react";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";

const abas = [
    { id: "bancos", label: "Bancos", titulo: "Cadastro de bancos" },
    { id: "agencias", label: "Agências", titulo: "Cadastro de agências" },
    { id: "contas", label: "Contas Bancárias", titulo: "Cadastro de contas bancárias" },
] as const;

export default function DadosBancarios() {
    const [aba, setAba] = useState(0);
    const selecionada = abas[aba];

    return (
        <Box>
            <PageHeader
                titulo="Dados Bancários"
                descricao="Organize bancos, agências e contas bancárias em uma única rotina."
            />

            <Paper variant="outlined" sx={{ mt: 2.5, overflow: "hidden" }}>
                <Tabs
                    value={aba}
                    onChange={(_, valor: number) => setAba(valor)}
                    variant="scrollable"
                    scrollButtons="auto"
                    aria-label="Cadastros de dados bancários"
                    sx={{ borderBottom: 1, borderColor: "divider", px: { xs: 1, sm: 2 } }}
                >
                    {abas.map((item) => (
                        <Tab key={item.id} label={item.label} id={`tab-${item.id}`} aria-controls={`tabpanel-${item.id}`} />
                    ))}
                </Tabs>

                <Box role="tabpanel" id={`tabpanel-${selecionada.id}`} aria-labelledby={`tab-${selecionada.id}`}>
                    <EmptyState
                        titulo={selecionada.titulo}
                        descricao="Este cadastro será disponibilizado quando a integração financeira estiver concluída."
                        icone={<AccountBalanceRoundedIcon sx={{ fontSize: 44 }} />}
                    />
                </Box>
            </Paper>
        </Box>
    );
}
