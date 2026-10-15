import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import AddShoppingCartRoundedIcon from "@mui/icons-material/AddShoppingCartRounded";
import WarehouseRoundedIcon from "@mui/icons-material/WarehouseRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import type { ReactNode } from "react";
import Caixa from "../pages/Financeiro/Caixa";
import Clientes from "../pages/Clientes/Clientes";
import Dashboard from "../pages/Dashboard/Dashboard";
import Empresa from "../pages/Empresa/Empresa";
import Estoque from "../pages/Estoque/Estoque";
import Produtos from "../pages/Produtos/ProdutosArea";
import CentralVendas from "../pages/Vendas/CentralVendas";
import Vendas from "../pages/Vendas/Vendas";
import DadosBancarios from "../pages/Financeiro/DadosBancarios";
import FormasPagamento from "../pages/Financeiro/FormasPagamento";
import Usuarios from "../pages/Usuarios/Usuarios";
import ContasPagar from "../pages/Financeiro/ContasPagar";
import ContasReceber from "../pages/Financeiro/ContasReceber";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import ContasFinanceiras from "../pages/Financeiro/ContasFinanceiras";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import Recebiveis from "../pages/Financeiro/Recebiveis";
import Configuracoes from "../pages/Configuracoes/Configuracoes";

export type RotaInterna = {
    caminho: string;
    busca?: string;
    titulo: string;
    icone: ReactNode;
    elemento: ReactNode;
};

// O PDV preserva seu layout operacional, fora do MainLayout.
export const rotaPdv: RotaInterna = {
    caminho: "pdv",
    titulo: "Vender",
    icone: <AddShoppingCartRoundedIcon />,
    elemento: <Vendas />,
};

export const rotasInternas: RotaInterna[] = [
    {
        caminho: "configuracoes",
        titulo: "Configurações",
        icone: <SettingsRoundedIcon />,
        elemento: <Configuracoes />,
    },
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
        titulo: "Central de Vendas",
        icone: <ReceiptLongRoundedIcon />,
        elemento: <CentralVendas />,
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
        caminho: "financeiro/contas-financeiras",
        titulo: "Contas e saldos",
        icone: <SavingsRoundedIcon />,
        elemento: <ContasFinanceiras />,
    },
    {
        caminho: "financeiro/contas-pagar",
        titulo: "Contas a Pagar",
        icone: <ReceiptLongRoundedIcon />,
        elemento: <ContasPagar />,
    },
    {
        caminho: "financeiro/contas-receber",
        titulo: "Contas a Receber",
        icone: <ReceiptLongRoundedIcon />,
        elemento: <ContasReceber />,
    },
    {
        caminho: "financeiro/recebiveis",
        titulo: "Recebimentos de cartão",
        icone: <CreditCardRoundedIcon />,
        elemento: <Recebiveis />,
    },
    {
        caminho: "financeiro/dados-bancarios",
        titulo: "Dados bancários",
        icone: <AccountBalanceRoundedIcon />,
        elemento: <DadosBancarios />,
    },
    {
        caminho: "financeiro/formas-pagamento",
        titulo: "Formas de pagamento",
        icone: <PaymentsRoundedIcon />,
        elemento: <FormasPagamento />,
    },
    {
        caminho: "usuarios",
        titulo: "Usuários",
        icone: <PeopleAltRoundedIcon />,
        elemento: <Usuarios />,
    },
];

// O menu aponta para telas e abas existentes; o PDV mantém seu layout independente.
export type ItemMenu =
    | { tipo: "rota"; id: string; rota: RotaInterna; titulo?: string }
    | { tipo: "grupo"; id: string; titulo: string; icone: ReactNode; destinoDireto?: string; rodape?: boolean; filhos: Extract<ItemMenu, { tipo: "rota" }>[] };

export type AreaMenu = Extract<ItemMenu, { tipo: "grupo" }>;

const rotaCaixas = rotasInternas.find(r => r.caminho === "financeiro/caixas")!;
const rotaContasFinanceiras = rotasInternas.find(r => r.caminho === "financeiro/contas-financeiras")!;
const rotaContasPagar = rotasInternas.find(r => r.caminho === "financeiro/contas-pagar")!;
const rotaContasReceber = rotasInternas.find(r => r.caminho === "financeiro/contas-receber")!;
const rotaRecebiveis = rotasInternas.find(r => r.caminho === "financeiro/recebiveis")!;

const rotaProdutos = rotasInternas.find(r => r.caminho === "produtos")!;
const rotaEstoque = rotasInternas.find(r => r.caminho === "estoque")!;

export const menuPrincipal: AreaMenu[] = [
    { tipo: "grupo", id: "inicio", titulo: "Visão geral", destinoDireto: "/dashboard", icone: <DashboardRoundedIcon />, filhos: [
        { tipo: "rota", id: "dashboard", rota: rotasInternas.find(r => r.caminho === "dashboard")! },
    ] },
    { tipo: "grupo", id: "cadastros", titulo: "Cadastros", icone: <Inventory2RoundedIcon />, filhos: [
        { tipo: "rota", id: "produtos", rota: rotaProdutos },
        { tipo: "rota", id: "clientes", rota: rotasInternas.find(r => r.caminho === "clientes")! },
        { tipo: "rota", id: "fornecedores", rota: { ...rotaProdutos, titulo: "Fornecedores", busca: "?aba=fornecedores", icone: <BusinessRoundedIcon /> } },
    ] },
    { tipo: "grupo", id: "estoque", titulo: "Estoque", icone: <WarehouseRoundedIcon />, filhos: [
        { tipo: "rota", id: "saldo", titulo: "Saldo", rota: rotaEstoque },
        { tipo: "rota", id: "entradas", rota: { ...rotaEstoque, titulo: "Entradas de mercadoria", busca: "?aba=entradas" } },
    ] },
    { tipo: "grupo", id: "vendas", titulo: "Vendas", icone: <ReceiptLongRoundedIcon />, filhos: [
        { tipo: "rota", id: "pdv", titulo: "PDV", rota: rotaPdv },
        { tipo: "rota", id: "central-vendas", rota: rotasInternas.find(r => r.caminho === "vendas")! },
    ] },
    {
        tipo: "grupo",
        id: "financeiro",
        titulo: "Financeiro",
        icone: <AccountBalanceWalletRoundedIcon />,
        filhos: [
            { tipo: "rota", id: "caixas", titulo: "Caixas", rota: rotaCaixas },
            { tipo: "rota", id: "contas-financeiras", rota: rotaContasFinanceiras },
            { tipo: "rota", id: "contas-pagar", titulo: "Contas a Pagar", rota: rotaContasPagar },
            { tipo: "rota", id: "contas-receber", rota: rotaContasReceber },
            { tipo: "rota", id: "recebiveis", rota: rotaRecebiveis },
        ],
    },
    {
        tipo: "grupo",
        id: "configuracoes",
        titulo: "Configurações",
        destinoDireto: "/configuracoes",
        rodape: true,
        icone: <SettingsRoundedIcon />,
        filhos: [
            { tipo: "rota", id: "central-configuracoes", titulo: "Central de configurações", rota: rotasInternas.find(r => r.caminho === "configuracoes")! },
        ],
    },
];

export function ehRotaConfiguracao(pathname: string): boolean {
    return ["/configuracoes", "/empresa", "/usuarios", "/financeiro/formas-pagamento", "/financeiro/dados-bancarios"].includes(pathname);
}

export function itemMenuAtivo(item: ItemMenu, pathname: string, search = ""): boolean {
    if (item.tipo === "grupo" && item.id === "configuracoes") return ehRotaConfiguracao(pathname);
    if (item.tipo === "grupo") return item.filhos.some(filho => itemMenuAtivo(filho, pathname, search));
    if (`/${item.rota.caminho}` !== pathname) return false;
    const aba = new URLSearchParams(search).get("aba");
    const destino = new URLSearchParams(item.rota.busca).get("aba");
    if (destino) return aba === destino;
    if (pathname === "/produtos") return aba !== "fornecedores";
    if (pathname === "/estoque") return aba !== "entradas";
    return true;
}

export function obterCaminhoDaRota(rota: RotaInterna): string {
    return `/${rota.caminho}${rota.busca ?? ""}`;
}

export function obterTituloDaPagina(pathname: string, search = ""): string {
    const aba = new URLSearchParams(search).get("aba");
    if (pathname === "/produtos" && aba === "fornecedores") return "Fornecedores";
    if (pathname === "/estoque" && aba === "entradas") return "Entradas de mercadoria";
    const rota = rotasInternas.find(
        (item) => obterCaminhoDaRota(item) === pathname
    );

    return rota?.titulo ?? "Novexa ERP";
}
