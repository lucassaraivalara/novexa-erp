import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Paper, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import { podeGerenciarUsuarios, podeExecutarAcaoGerencial } from "../../utils/auth/perfis";
import { obterSessao } from "../../utils/auth/sessao";

export default function Configuracoes() {
    const secoes = [
        { id: "empresa", titulo: "Empresa", links: [
            { titulo: "Empresas", descricao: "Consulte e mantenha os dados da empresa.", caminho: "/empresa", icone: <BusinessRoundedIcon /> },
        ] },
        { id: "acesso", titulo: "Usuários e acesso", links: podeGerenciarUsuarios(obterSessao()?.perfil) ? [
            { titulo: "Usuários", descricao: "Gerencie usuários e seus perfis de acesso.", caminho: "/usuarios", icone: <PeopleAltRoundedIcon /> },
        ] : [] },
        { id: "financeiro", titulo: "Financeiro", links: [
            ...(podeExecutarAcaoGerencial(obterSessao()?.perfil) ? [{ titulo: "Recebimentos e Caixa", descricao: "Defina a política de recebimentos e a conferência do fechamento.", caminho: "/configuracoes/recebimentos-caixa", icone: <PaymentsRoundedIcon /> }] : []),
            { titulo: "Formas de pagamento", descricao: "Configure as formas de pagamento da empresa.", caminho: "/financeiro/formas-pagamento", icone: <PaymentsRoundedIcon /> },
            { titulo: "Dados bancários", descricao: "Organize bancos, agências e contas bancárias.", caminho: "/financeiro/dados-bancarios", icone: <AccountBalanceRoundedIcon /> },
        ] },
        { id: "produtos", titulo: "Produtos", links: [
            { titulo: "Categorias e subcategorias", descricao: "Mantenha os grupos e subgrupos de produtos da empresa.", caminho: "/configuracoes/categorias-produtos", icone: <CategoryRoundedIcon /> },
            { titulo: "Marcas", descricao: "Mantenha os nomes e a situação das marcas da empresa.", caminho: "/configuracoes/marcas-produtos", icone: <SellRoundedIcon /> },
        ] },
    ].filter(secao => secao.links.length > 0);

    return <PageContainer>
        <PageHeader titulo="Configurações" descricao="Acesse os cadastros administrativos e as configurações da empresa." />
        <Paper variant="outlined" sx={{ boxShadow: "none", overflow: "hidden" }}>
            {secoes.map((secao, index) => <Box component="section" aria-labelledby={`configuracoes-${secao.id}`} key={secao.id}
                sx={{ p: { xs: 1.5, sm: 2 }, borderTop: index ? 1 : 0, borderColor: "divider" }}>
                <Typography id={`configuracoes-${secao.id}`} component="h2" variant="h6" sx={{ mb: 0.5 }}>{secao.titulo}</Typography>
                <List disablePadding>
                    {secao.links.map(link => <ListItemButton component={Link} to={link.caminho} key={link.caminho}
                        sx={{ minHeight: 56, px: 1, borderRadius: "6px", gap: 1,
                            "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 } }}>
                        <ListItemIcon sx={{ minWidth: 28, color: "primary.main" }}>{link.icone}</ListItemIcon>
                        <ListItemText primary={link.titulo} secondary={link.descricao} sx={{ minWidth: 0 }} />
                        <ChevronRightRoundedIcon sx={{ color: "text.secondary", fontSize: 18 }} />
                    </ListItemButton>)}
                </List>
            </Box>)}
        </Paper>
    </PageContainer>;
}
