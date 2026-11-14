import CampoTexto from "../../components/ui/CampoTexto";
import { useState } from "react";
import { type TextFieldProps } from "@mui/material";
import { formatarValorMonetario, normalizarCentavos, normalizarValorMonetario } from "./pdv";

type Props = Omit<TextFieldProps, "value" | "onChange" | "type"> & {
    value: string;
    onChange: (valor: string) => void;
    entradaCentavos?: boolean;
};

export default function ValorMonetarioPDV({ value, onChange, onFocus, onBlur, entradaCentavos = false, ...props }: Props) {
    const [edicao, setEdicao] = useState<string | null>(null);
    const invalido = normalizarValorMonetario(edicao ?? value) === null;
    return <CampoTexto placeholder={props.placeholder ?? "0,00"} {...props} value={entradaCentavos ? formatarValorMonetario(value) : edicao ?? formatarValorMonetario(value)}
        error={props.error || invalido}
        helperText={invalido ? "Informe um valor com até duas casas decimais." : props.helperText}
        onFocus={e => { if (!entradaCentavos) setEdicao(e.target.value); e.target.select(); onFocus?.(e); }}
        onChange={e => {
            const texto = e.target.value;
            if (entradaCentavos) {
                const valor = normalizarCentavos(texto);
                if (valor !== null) onChange(valor);
                return;
            }
            if (normalizarValorMonetario(texto) === null) return;
            setEdicao(texto);
            onChange(normalizarValorMonetario(texto) ?? texto);
        }}
        onBlur={e => { setEdicao(null); onBlur?.(e); }} />;
}
