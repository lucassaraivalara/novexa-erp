import { useState } from "react";
import { TextField, type TextFieldProps } from "@mui/material";
import { formatarValorMonetario, normalizarValorMonetario } from "./pdv";

type Props = Omit<TextFieldProps, "value" | "onChange" | "type"> & {
    value: string;
    onChange: (valor: string) => void;
};

export default function ValorMonetarioPDV({ value, onChange, onFocus, onBlur, ...props }: Props) {
    const [edicao, setEdicao] = useState<string | null>(null);
    const invalido = normalizarValorMonetario(edicao ?? value) === null;
    return <TextField {...props} value={edicao ?? formatarValorMonetario(value)}
        error={props.error || invalido}
        helperText={invalido ? "Informe um valor com até duas casas decimais." : props.helperText}
        onFocus={e => { setEdicao(e.target.value); e.target.select(); onFocus?.(e); }}
        onChange={e => {
            const texto = e.target.value;
            setEdicao(texto);
            onChange(normalizarValorMonetario(texto) ?? texto);
        }}
        onBlur={e => { setEdicao(null); onBlur?.(e); }} />;
}
