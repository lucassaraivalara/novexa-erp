import { useState } from "react";
import { Stack, Tab, Tabs } from "@mui/material";
import Fornecedores from "./Fornecedores";
import Produtos from "./Produtos";

// Fornecedores fica contextualizado em Produtos, sem item próprio no menu.
export default function ProdutosArea() {
    const [aba, setAba] = useState<"produtos" | "fornecedores">("produtos");
    return <Stack spacing={2}>
        <Tabs value={aba} onChange={(_, valor) => setAba(valor)} aria-label="Cadastros de produtos" sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tab value="produtos" label="Produtos" />
            <Tab value="fornecedores" label="Fornecedores" />
        </Tabs>
        {aba === "produtos" ? <Produtos /> : <Fornecedores />}
    </Stack>;
}
