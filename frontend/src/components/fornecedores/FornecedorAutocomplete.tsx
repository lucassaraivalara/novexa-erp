import { useCallback, useState } from "react";
import { Autocomplete, CircularProgress, TextField } from "@mui/material";
import { useRemoteSearch } from "../../hooks/useRemoteSearch";
import { buscarFornecedores } from "../../services/fornecedorService";
import type { Fornecedor, FornecedorBusca } from "../../types/fornecedor";

export type FornecedorOpcao = Pick<Fornecedor, "id" | "razaoSocial"> & Partial<FornecedorBusca>;

type Props = {
    value: FornecedorOpcao | null;
    onChange: (fornecedor: FornecedorOpcao | null) => void;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    error?: boolean;
    helperText?: string;
    size?: "small" | "medium";
    minWidth?: number;
};

// A busca é remota (somente fornecedores ativos); o valor selecionado permanece mesmo fora das opções atuais.
export default function FornecedorAutocomplete({ value, onChange, label = "Fornecedor", placeholder, disabled,
    error, helperText, size, minWidth }: Props) {
    const [opcoes, setOpcoes] = useState<FornecedorOpcao[]>([]);
    const buscar = useCallback((termo: string, signal: AbortSignal) => buscarFornecedores(termo, signal), []);
    const { setTerm, loading } = useRemoteSearch<FornecedorBusca>({
        search: buscar, onResults: setOpcoes, onError: () => setOpcoes([]),
    });
    const visiveis = value && !opcoes.some((item) => item.id === value.id) ? [value, ...opcoes] : opcoes;

    return <Autocomplete options={visiveis} value={value} size={size} disabled={disabled} loading={loading}
        sx={minWidth ? { minWidth } : undefined} filterOptions={(lista) => lista}
        getOptionLabel={(item) => item.razaoSocial} isOptionEqualToValue={(a, b) => a.id === b.id}
        noOptionsText="Nenhum fornecedor ativo encontrado" loadingText="Buscando fornecedores…"
        onInputChange={(_, texto, motivo) => { if (motivo === "input") setTerm(texto); }}
        onChange={(_, item) => onChange(item)}
        renderInput={(params) => <TextField {...params} label={label} placeholder={placeholder} error={error}
            helperText={helperText} slotProps={{ ...params.slotProps, input: { ...params.slotProps.input, endAdornment: <>
                {loading ? <CircularProgress size={16} /> : null}{params.slotProps.input.endAdornment}</> } }} />} />;
}
