import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import WarehouseRoundedIcon from "@mui/icons-material/WarehouseRounded";
import type { ReactNode } from "react";
import Clientes from "../pages/Clientes/Clientes";
import Dashboard from "../pages/Dashboard/Dashboard";
import Empresa from "../pages/Empresa/Empresa";
import Estoque from "../pages/Estoque/Estoque";
import Produtos from "../pages/Produtos/Produtos";
import Vendas from "../pages/Vendas/Vendas";

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
        titulo: "Empresa",
        icone: <BusinessRoundedIcon />,
        elemento: <Empresa />,
    },
];

export function obterCaminhoDaRota(rota: RotaInterna): string {
    return `/${rota.caminho}`;
}

export function obterTituloDaPagina(pathname: string): string {
    const rota = rotasInternas.find(
        (item) => obterCaminhoDaRota(item) === pathname
    );

    return rota?.titulo ?? "Novexa ERP";
}
