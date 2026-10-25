import { TextField, type TextFieldProps } from "@mui/material";

/** Mesmos contratos do MUI; orientação visível sem esconder o label no campo vazio. */
export default function CampoTexto({ slotProps, sx, ...props }: TextFieldProps) {
    const label = slotProps?.inputLabel;
    const ajuda = slotProps?.formHelperText;
    return <TextField {...props} autoComplete={props.autoComplete ?? "off"}
        name={props.name ?? (typeof props.label === "string" ? props.label : undefined)}
        slotProps={{ ...slotProps,
            inputLabel: typeof label === "function"
                ? owner => ({ shrink: true, ...label(owner) }) : { shrink: true, ...label },
            formHelperText: typeof ajuda === "function"
                ? owner => ({ "aria-live": "polite", ...ajuda(owner) }) : { "aria-live": "polite", ...ajuda },
        }}
        sx={[{ minWidth: 0, "& .MuiOutlinedInput-root:not(.MuiInputBase-multiline)": { minHeight: 44 },
            "& input::placeholder, & textarea::placeholder": { color: "text.secondary", opacity: 1 } },
            ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} />;
}
