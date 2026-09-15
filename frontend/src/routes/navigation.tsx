import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import WarehouseRoundedIcon from "@mui/icons-material/WarehouseRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import type { ReactNode } from "react";
import Caixa from "../pages/Financeiro/Caixa";
import Clientes from "../pages/Clientes/Clientes";
import Dashboard from "../pages/Dashboard/Dashboard";
import Empresa from "../pages/Empresa/Empresa";
import Estoque from "../pages/Estoque/Estoque";
import Produtos from "../pages/Produtos/Produtos";
import Vendas from "../pages/Vendas/Vendas";
import DadosBancarios from "../pages/Financeiro/DadosBancarios";
import FormasPagamento from "../pages/Financeiro/FormasPagamento";

export type RotaInterna = {
    caminho: string;
    titulo: string;
    icone: ReactNode;
    elemento: ReactNode;
};

export const rotasInternas: RotaInterna[] = [
    {
        caminho: "dashboard",
        titulo: "Dashboard",
        icone: <DashboardRoundedIcon />,
        elemento: <Dashboard />,
    },
    {
        caminho: "produtos",
        titulo: "Produtos",
        icone: <Inventory2RoundedIcon />,
        elemento: <Produtos />,
    },
    {
        caminho: "clientes",
        titulo: "Clientes",
        icone: <PeopleAltRoundedIcon />,
        elemento: <Clientes />,
    },
    {
        caminho: "estoque",
        titulo: "Estoque",
        icone: <WarehouseRoundedIcon />,
        elemento: <Estoque />,
    },
    {
        caminho: "vendas",
        titulo: "Vendas",
        icone: <PointOfSaleRoundedIcon />,
        elemento: <Vendas />,
    },
    {
        caminho: "empresa",
        titulo: "Empresas",
        icone: <BusinessRoundedIcon />,
        elemento: <Empresa />,
    },
    {
        caminho: "financeiro/caixas",
        titulo: "Caixas",
        icone: <AccountBalanceWalletRoundedIcon />,
        elemento: <Caixa />,
    },
    {
        caminho: "financeiro/dados-bancarios",
        titulo: "Dados Bancários",
        icone: <AccountBalanceRoundedIcon />,
        elemento: <DadosBancarios />,
    },
    {
        caminho: "financeiro/formas-pagamento",
        titulo: "Formas de Pagamento",
        icone: <AccountBalanceWalletRoundedIcon />,
        elemento: <FormasPagamento />,
    },
];

// A navegação pode agrupar rotas existentes ou reservar itens sem destino.
// Apenas rotasInternas gera páginas em AppRoutes.
export type ItemMenu =
    | { tipo: "rota"; id: string; rota: RotaInterna; titulo?: string }
    | { tipo: "grupo"; id: string; titulo: string; icone: ReactNode; filhos: ItemMenu[]; abertoInicialmente?: boolean }
    | { tipo: "indisponivel"; id: string; titulo: string; icone: ReactNode };

const rotaEmpresas = rotasInternas.find(r => r.caminho === "empresa")!;
const rotaCaixas = rotasInternas.find(r => r.caminho === "financeiro/caixas")!;
const rotaDadosBancarios = rotasInternas.find(r => r.caminho === "financeiro/dados-bancarios")!;
const rotaFormasPagamento = rotasInternas.find(r => r.caminho === "financeiro/formas-pagamento")!;

export const menuPrincipal: ItemMenu[] = [
    ...rotasInternas
        .filter(r => r.caminho !== "empresa" && !r.caminho.startsWith("financeiro/"))
        .map(rota => ({ tipo: "rota" as const, id: rota.caminho, rota })),
    {
        tipo: "grupo",
        id: "administracao",
        titulo: "Administração",
        icone: <SettingsRoundedIcon />,
        abertoInicialmente: true,
        filhos: [{
            tipo: "grupo",
            id: "administracao-cadastros",
            titulo: "Cadastros",
            icone: <FormatListBulletedRoundedIcon />,
            abertoInicialmente: true,
            filhos: [
                { tipo: "rota", id: "empresas", titulo: "Empresas", rota: rotaEmpresas },
                { tipo: "indisponivel", id: "usuarios", titulo: "Usuários", icone: <PeopleAltRoundedIcon /> },
                { tipo: "indisponivel", id: "padroes-novo-cliente", titulo: "Padrões p/ Novo Cliente", icone: <PersonAddAltRoundedIcon /> },
            ],
        }],
    },
    {
        tipo: "grupo",
        id: "financeiro",
        titulo: "Financeiro",
        icone: <AccountBalanceWalletRoundedIcon />,
        abertoInicialmente: true,
        filhos: [{
            tipo: "grupo",
            id: "financeiro-cadastros",
            titulo: "Cadastros",
            icone: <FormatListBulletedRoundedIcon />,
            abertoInicialmente: true,
            filhos: [
                { tipo: "rota", id: "caixas", titulo: "Caixas", rota: rotaCaixas },
                { tipo: "rota", id: "dados-bancarios", titulo: "Dados Bancários", rota: rotaDadosBancarios },
                { tipo: "rota", id: "formas-pagamento", titulo: "Formas de Pagamento", rota: rotaFormasPagamento },
            ],
        }],
    },
];

export function itemMenuAtivo(item: ItemMenu, pathname: string): boolean {
    if (item.tipo === "grupo") return item.filhos.some(filho => itemMenuAtivo(filho, pathname));
    return item.tipo === "rota" && obterCaminhoDaRota(item.rota) === pathname;
}

export function obterCaminhoDaRota(rota: RotaInterna): string {
    return `/${rota.caminho}`;
}

export function obterTituloDaPagina(pathname: string): string {
    const rota = rotasInternas.find(
        (item) => obterCaminhoDaRota(item) === pathname
    );

    return rota?.titulo ?? "Novexa ERP";
}
