import { useState, type Ref } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { useRemoteSearch } from "../../hooks/useRemoteSearch";
import { pesquisarClientes, mensagemCliente } from "../../services/clienteService";
import type { Cliente } from "../../types/cliente";

type Props = {
    value: Cliente | null;
    onChange: (cliente: Cliente | null) => void;
    disabled?: boolean;
    inputRef?: Ref<HTMLInputElement>;
    label?: string;
    placeholder?: string;
    size?: "small" | "medium";
    minWidth?: number;
    incluirInativos?: boolean;
};

export default function ClienteAutocomplete({ value, onChange, disabled, inputRef, label = "Cliente (opcional)",
    placeholder, size, minWidth, incluirInativos = false }: Props) {
    const [opcoes, setOpcoes] = useState<Cliente[]>([]);
    const [erro, setErro] = useState("");
    const { setTerm, loading } = useRemoteSearch<Cliente>({
        enabled: !disabled, search: (termo, signal) => pesquisarClientes(termo, signal, incluirInativos),
        onResults: resultados => { setOpcoes(resultados); setErro(""); },
        onError: e => { setOpcoes([]); setErro(mensagemCliente(e, "Não foi possível buscar os clientes.")); },
        onInvalidTerm: () => setOpcoes([]),
    });
    const visiveis = value && !opcoes.some(c => c.id === value.id) ? [value, ...opcoes] : opcoes;
    return <Autocomplete options={visiveis} value={value} disabled={disabled} autoHighlight loading={loading}
        size={size} sx={minWidth ? { minWidth } : undefined}
        filterOptions={lista => lista} getOptionLabel={c => c.nome + (c.cpfCnpj ? " · " + c.cpfCnpj : "")
            + (incluirInativos && !c.ativo ? " (inativo)" : "")}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        noOptionsText={incluirInativos ? "Nenhum cliente encontrado" : "Nenhum cliente ativo encontrado"} loadingText="Buscando clientes…"
        onInputChange={(_, texto, motivo) => {
            if (motivo === "input" || motivo === "clear") { setOpcoes([]); setErro(""); setTerm(texto); }
        }}
        onChange={(_, cliente) => onChange(cliente)}
        renderInput={params => <TextField {...params} inputRef={inputRef} label={label} placeholder={placeholder}
            error={!!erro} helperText={erro} />} />;
}
