import { useId, useState } from "react";
import { IconButton, InputAdornment, TextField, type TextFieldProps } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import { ajustarDecimal, formatarDecimal, normalizarDecimal, numeroDecimal } from "../../utils/numeroFormulario";

type Props = Omit<TextFieldProps, "value" | "onChange" | "type" | "label" | "slotProps"> & {
    label: string;
    value: string;
    // false preserva validadores de digitação existentes, como o limite de quantidade do PDV.
    onValueChange: (valor: string) => void | boolean;
    casas?: number;
    casasMinimas?: number;
    minimo?: number;
    maximo?: number;
    passo?: string;
    unidade?: string;
    moeda?: boolean;
    percentual?: boolean;
    canonico?: boolean;
    readOnly?: boolean;
    rotuloAcessivel?: string;
    descricaoId?: string;
};

/** Texto durante a digitação; pt-BR ao sair. A precisão é definida pelo campo consumidor. */
export default function CampoDecimal({ label, value, onValueChange, casas = 3, casasMinimas = casas, minimo = 0, maximo,
    passo, unidade, moeda = false, percentual = false, canonico = false, readOnly = false,
    rotuloAcessivel, descricaoId, onFocus, onBlur, onKeyDown, ...props }: Props) {
    const [edicao, setEdicao] = useState<string | null>(null);
    const idGerado = useId();
    const id = props.id ?? idGerado;
    const numero = numeroDecimal(value, casas, moeda);
    const invalido = !props.disabled && !readOnly && value.trim() !== "" && (numero === null || numero < minimo || (maximo !== undefined && numero > maximo));
    const textoNormalizado = normalizarDecimal(value, casas, moeda);
    const orientacao = numero === null && textoNormalizado !== null && textoNormalizado !== ""
        ? "Este valor não pode ser enviado sem perda de precisão. Revise o valor informado."
        : maximo !== undefined
        ? `Informe um valor de ${formatarDecimal(String(minimo), casas)} a ${formatarDecimal(String(maximo), casas)}, com até ${casas} casas decimais.`
        : `Informe um valor maior ou igual a ${formatarDecimal(String(minimo), casas)}, com até ${casas} casas decimais, sem letras ou símbolos.`;
    const ajuda = props.error ? props.helperText : invalido ? orientacao : props.helperText;
    const alterar = (direcao: 1 | -1) => {
        if (!passo || invalido || props.disabled || readOnly) return;
        const proximo = ajustarDecimal(value, casas, passo, direcao, minimo, maximo);
        if (proximo !== null) {
            const aceito = onValueChange(canonico ? normalizarDecimal(proximo, casas, moeda) ?? proximo : proximo);
            if (aceito !== false && edicao !== null) setEdicao(proximo);
        }
    };

    return <TextField {...props} id={id} label={label} type="text" fullWidth
        sx={[{ minWidth: 0, "& .MuiOutlinedInput-root": { minHeight: 44 } },
            ...(Array.isArray(props.sx) ? props.sx : props.sx ? [props.sx] : [])]}
        name={props.name ?? label}
        autoComplete={props.autoComplete ?? "off"}
        value={edicao ?? (invalido ? value : formatarDecimal(value, casas, moeda, casasMinimas))}
        error={props.error || invalido}
        helperText={ajuda}
        onChange={e => {
            const texto = e.target.value;
            const aceito = onValueChange(canonico ? normalizarDecimal(texto, casas, moeda) ?? texto : texto);
            if (aceito !== false) setEdicao(texto);
        }}
        onFocus={e => { setEdicao(e.target.value); onFocus?.(e); }}
        onBlur={e => { setEdicao(null); onBlur?.(e); }}
        onKeyDown={e => {
            onKeyDown?.(e);
            if (passo && !e.defaultPrevented && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                e.preventDefault(); alterar(e.key === "ArrowUp" ? 1 : -1);
            }
        }}
        slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { inputMode: casas === 0 ? "numeric" : "decimal", spellCheck: false,
                ...(rotuloAcessivel ? { "aria-label": rotuloAcessivel } : {}),
                ...(descricaoId ? { "aria-describedby": [descricaoId, ajuda ? `${id}-helper-text` : ""].filter(Boolean).join(" ") } : {}),
                ...(passo ? { role: "spinbutton", "aria-valuemin": minimo, "aria-valuemax": maximo,
                    "aria-valuenow": numero ?? undefined, "aria-valuetext": value ? `${formatarDecimal(value, casas, false, casasMinimas)}${unidade ? ` ${unidade}` : ""}` : undefined } : {}),
            },
            formHelperText: { "aria-live": "polite" },
            input: {
                readOnly,
                sx: { fontVariantNumeric: "tabular-nums",
                    "& input::placeholder": { color: "text.secondary", opacity: 1 } },
                startAdornment: moeda ? <InputAdornment position="start">R$</InputAdornment> : undefined,
                endAdornment: passo || unidade || percentual ? <InputAdornment position="end">
                    {unidade || (percentual ? "%" : null)}
                    {passo && <>
                        <IconButton type="button" size="small" aria-label={`Diminuir ${label.toLowerCase()}`}
                            disabled={props.disabled || readOnly || invalido || (numero ?? minimo) <= minimo}
                            onClick={() => alterar(-1)} sx={{ width: { xs: 44, sm: 32 }, height: { xs: 44, sm: 32 } }}>
                            <RemoveRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton type="button" size="small" aria-label={`Aumentar ${label.toLowerCase()}`}
                            disabled={props.disabled || readOnly || invalido || (maximo !== undefined && (numero ?? minimo) >= maximo)}
                            onClick={() => alterar(1)} sx={{ width: { xs: 44, sm: 32 }, height: { xs: 44, sm: 32 } }}>
                            <AddRoundedIcon fontSize="small" />
                        </IconButton>
                    </>}
                </InputAdornment> : undefined,
            },
        }} />;
}

export function CampoMonetario(props: Omit<Props, "moeda" | "passo">) {
    return <CampoDecimal casas={2} {...props} moeda />;
}

export function CampoQuantidade(props: Omit<Props, "moeda" | "percentual">) {
    return <CampoDecimal casas={3} {...props} />;
}

export function CampoPercentual(props: Omit<Props, "moeda" | "percentual">) {
    return <CampoDecimal casas={2} {...props} percentual />;
}
