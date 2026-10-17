import { useState } from "react";
import { Alert, Autocomplete, Box, Button, Stack, TextField } from "@mui/material";
import { useRemoteSearch } from "../../hooks/useRemoteSearch";
import { listarCategorias, listarSubcategorias, mensagemCategoria } from "../../services/categoriaProdutoService";
import { listarMarcas } from "../../services/marcaService";
import type { CategoriaProduto, SubcategoriaProduto } from "../../types/categoriaProduto";
import type { Marca } from "../../types/marca";
import type { ClassificacaoProduto } from "./classificacaoProdutoUtils";

type Opcao = CategoriaProduto | SubcategoriaProduto | Marca;
function Seletor({ tipo, value, categoriaId, onChange, disabled }: {
    tipo: "categoria" | "subcategoria" | "marca"; value: Opcao | null; categoriaId?: number;
    onChange: (valor: Opcao | null) => void; disabled?: boolean;
}) {
    const [opcoes, setOpcoes] = useState<Opcao[]>([]);
    const [erro, setErro] = useState("");
    const label = tipo === "categoria" ? "Categoria" : tipo === "subcategoria" ? "Subcategoria" : "Marca";
    const dependeCategoria = tipo === "subcategoria" && !categoriaId;
    const busca = useRemoteSearch<Opcao>({ minLength: 0, enabled: !dependeCategoria,
        search: async (termo, signal) => {
            const params = { termo, page: 0, size: 25, sort: "nome,asc" };
            const pagina = tipo === "categoria" ? await listarCategorias(params, signal)
                : tipo === "marca" ? await listarMarcas(params, signal)
                : await listarSubcategorias({ ...params, categoriaId }, signal);
            if (!Array.isArray(pagina.items)) throw new Error("Resposta de consulta inválida.");
            return pagina.items;
        },
        onResults: itens => { setOpcoes(itens); setErro(""); },
        onError: e => { setOpcoes([]); setErro(mensagemCategoria(e, `Não foi possível consultar ${label.toLowerCase()}.`)); },
    });
    const disponiveis = value && !opcoes.some(o => o.id === value.id) ? [value, ...opcoes] : opcoes;
    return <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Autocomplete value={value} options={disponiveis} disabled={disabled || dependeCategoria} loading={busca.loading}
            onChange={(_, item) => onChange(item)} isOptionEqualToValue={(a, b) => a.id === b.id}
            getOptionLabel={item => `${item.nome}${item.ativo ? "" : " (inativa)"}`} filterOptions={items => items}
            onInputChange={(_, texto, motivo) => { if (motivo === "input" || motivo === "clear") busca.setTerm(texto); }}
            noOptionsText={erro ? "Consulta indisponível" : "Nenhum cadastro encontrado"}
            renderInput={params => <TextField {...params} label={label} size="small" error={!!erro}
                helperText={dependeCategoria ? "Selecione a categoria." : "Opcional. Pesquise pelo nome."} />} />
        {erro && <Alert severity="error" action={<Button color="inherit" size="small" onClick={busca.refresh}>Tentar novamente</Button>}>{erro}</Alert>}
    </Stack>;
}

export default function ClassificacaoProdutoCampos({ valor, onChange, disabled }: {
    valor: ClassificacaoProduto; onChange: (valor: ClassificacaoProduto) => void; disabled?: boolean;
}) {
    return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1.5, minWidth: 0 }}>
        <Seletor tipo="categoria" value={valor.categoria} disabled={disabled}
            onChange={categoria => onChange({ ...valor, categoria, subcategoria: categoria?.id === valor.categoria?.id ? valor.subcategoria : null })} />
        <Seletor key={valor.categoria?.id ?? "sem-categoria"} tipo="subcategoria" value={valor.subcategoria} categoriaId={valor.categoria?.id}
            disabled={disabled} onChange={subcategoria => onChange({ ...valor, subcategoria: subcategoria as SubcategoriaProduto | null })} />
        <Seletor tipo="marca" value={valor.marca} disabled={disabled} onChange={marca => onChange({ ...valor, marca })} />
    </Box>;
}
