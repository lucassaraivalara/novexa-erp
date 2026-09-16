import { Box, Tab, Tabs } from "@mui/material";
import { useState } from "react";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import BancoTab from "./BancoTab";
import AgenciaTab from "./AgenciaTab";
import ContaBancariaTab from "./ContaBancariaTab";

const abas = [
    { id: "bancos", label: "Bancos" },
    { id: "agencias", label: "Agências" },
    { id: "contas", label: "Contas Bancárias" },
] as const;

export default function DadosBancarios() {
    const [aba, setAba] = useState(0);
    const selecionada = abas[aba];

    return (
        <PageContainer>
            <PageHeader
                titulo="Dados Bancários"
                descricao="Organize bancos, agências e contas bancárias em uma única rotina."
            />

            <Tabs
                value={aba}
                onChange={(_, valor: number) => setAba(valor)}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="Cadastros de dados bancários"
                sx={{ borderBottom: 1, borderColor: "divider" }}
            >
                {abas.map((item) => (
                    <Tab key={item.id} label={item.label} id={`tab-${item.id}`} aria-controls={`tabpanel-${item.id}`} />
                ))}
            </Tabs>

            <Box role="tabpanel" id={`tabpanel-${selecionada.id}`} aria-labelledby={`tab-${selecionada.id}`}>
                {aba === 0 && <BancoTab />}
                {aba === 1 && <AgenciaTab />}
                {aba === 2 && <ContaBancariaTab />}
            </Box>
        </PageContainer>
    );
}

