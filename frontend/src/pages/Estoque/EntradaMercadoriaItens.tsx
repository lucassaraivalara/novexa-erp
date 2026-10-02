import { useCallback, useState } from "react";
import { Autocomplete, Box, Button, CircularProgress, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { useRemoteSearch } from "../../hooks/useRemoteSearch";
import { pesquisarProdutos } from "../../services/produtoService";
import type { Produto } from "../../types/produto";
import { novoItemEntrada, type ItemFormularioEntrada, type ProdutoEntrada } from "./entradaMercadoriaRegras";

function ProdutoAutocomplete({ value, onChange, disabled }: {
    value: ProdutoEntrada | null; onChange: (produto: ProdutoEntrada | null) => void; disabled: boolean;
}) {
    const [opcoes, setOpcoes] = useState<Produto[]>([]);
    const [habilitado, setHabilitado] = useState(false);
    const [erro, setErro] = useState("");
    const buscar = useCallback((termo: string, signal: AbortSignal) => pesquisarProdutos(termo, signal), []);
    const { setTerm, loading } = useRemoteSearch<Produto>({ enabled: habilitado && !disabled, minLength: 2,
        search: buscar, onResults: dados => { setOpcoes(dados); setErro(""); },
        onError: () => { setOpcoes([]); setErro("Não foi possível buscar produtos."); } });
    const visiveis: ProdutoEntrada[] = value && !opcoes.some(p => p.id === value.id) ? [value, ...opcoes] : opcoes;
    return <Autocomplete value={value} options={visiveis} disabled={disabled} loading={loading} filterOptions={lista => lista}
        getOptionLabel={p => p.nome} isOptionEqualToValue={(a, b) => a.id === b.id}
        getOptionDisabled={p => p.ativo === false || p.controlaEstoque === false}
        noOptionsText="Digite pelo menos 2 caracteres para buscar produtos" loadingText="Buscando produtos…"
        onInputChange={(_, texto, motivo) => { if (motivo === "input" || motivo === "clear") {
            setTerm(texto); setHabilitado(texto.trim().length >= 2); setOpcoes([]);
        } }}
        onChange={(_, p) => { setTerm(""); setHabilitado(false); onChange(p); }}
        renderInput={params => <TextField {...params} label="Produto" required size="small" error={Boolean(erro)} helperText={erro || undefined}
            slotProps={{ ...params.slotProps, input: { ...params.slotProps.input, endAdornment: <>
                {loading && <CircularProgress size={16} />}{params.slotProps.input.endAdornment}</> } }} />} />;
}

export default function EntradaMercadoriaItens({ itens, onChange, disabled = false, somenteLeitura = false }: {
    itens: ItemFormularioEntrada[]; onChange: (itens: ItemFormularioEntrada[]) => void; disabled?: boolean; somenteLeitura?: boolean;
}) {
    function alterar(indice: number, dados: Partial<ItemFormularioEntrada>) {
        onChange(itens.map((item, i) => i === indice ? { ...item, ...dados } : item));
    }
    return <Stack spacing={1.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Itens</Typography>
        {itens.map((item, indice) => <Box key={item.chave} sx={{ display: "grid", gap: 1.5, alignItems: "start",
            gridTemplateColumns: { xs: "1fr 1fr", sm: "minmax(0, 1fr) 120px 140px 40px" } }}>
            <Box sx={{ minWidth: 0, gridColumn: { xs: "1 / -1", sm: "auto" } }}>
                {somenteLeitura ? <TextField fullWidth size="small" label="Produto" value={item.produto?.nome ?? ""}
                    slotProps={{ input: { readOnly: true } }} /> : <ProdutoAutocomplete value={item.produto} disabled={disabled}
                    onChange={produto => alterar(indice, { produto, custo: produto?.precoCusto !== undefined ? String(produto.precoCusto) : item.custo })} />}
            </Box>
            <TextField label="Quantidade" size="small" required value={item.quantidade} disabled={disabled && !somenteLeitura}
                onChange={e => alterar(indice, { quantidade: e.target.value })}
                slotProps={{ input: { readOnly: somenteLeitura }, htmlInput: { inputMode: "decimal" } }} />
            <TextField label="Custo unitário" size="small" required value={item.custo} disabled={disabled && !somenteLeitura}
                onChange={e => alterar(indice, { custo: e.target.value })}
                slotProps={{ input: { readOnly: somenteLeitura }, htmlInput: { inputMode: "decimal" } }} />
            {!somenteLeitura && <Tooltip title="Remover item"><span><IconButton disabled={disabled} aria-label={`Remover item ${indice + 1}`}
                onClick={() => onChange(itens.flatMap((v, i) => i === indice ? [] : [v]))}><DeleteOutlineRoundedIcon /></IconButton></span></Tooltip>}
        </Box>)}
        {!somenteLeitura && <Button sx={{ alignSelf: "flex-start" }} disabled={disabled || itens.length >= 200}
            startIcon={<AddRoundedIcon />} onClick={() => onChange([...itens, novoItemEntrada()])}>Adicionar item</Button>}
    </Stack>;
}
