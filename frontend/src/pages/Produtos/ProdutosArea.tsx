import { useSearchParams } from "react-router-dom";
import { Stack, Tab, Tabs } from "@mui/material";
import Fornecedores from "./Fornecedores";
import Produtos from "./Produtos";

// O menu e as abas compartilham a mesma URL, sem duplicar telas.
export default function ProdutosArea() {
    const [params, setParams] = useSearchParams();
    const aba = params.get("aba") === "fornecedores" ? "fornecedores" : "produtos";
    return <Stack spacing={2}>
        <Tabs value={aba} onChange={(_, valor) => {
            const proximo = new URLSearchParams(params);
            if (valor === "fornecedores") proximo.set("aba", valor); else proximo.delete("aba");
            setParams(proximo, { replace: true });
        }} aria-label="Cadastros de produtos" sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tab value="produtos" label="Produtos" />
            <Tab value="fornecedores" label="Fornecedores" />
        </Tabs>
        {aba === "produtos" ? <Produtos /> : <Fornecedores />}
    </Stack>;
}
