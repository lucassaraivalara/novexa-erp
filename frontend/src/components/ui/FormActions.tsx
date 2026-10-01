import { Button, Stack } from "@mui/material";
import { layoutTokens } from "../layout/layoutTokens";
import type { ReactNode } from "react";
import type { SxProps } from "@mui/system";

interface FormActionsProps {
    onSalvar?: () => void;
    onCancelar: () => void;
    salvando?: boolean;
    textoSalvar?: string;
    textoCancelar?: string;
    desabilitado?: boolean;
    varianteSalvar?: "contained" | "outlined";
    tipoSalvar?: "button" | "submit";
    iconeSalvar?: ReactNode;
    sx?: SxProps;
}

export default function FormActions({
    onSalvar,
    onCancelar,
    salvando = false,
    textoSalvar = "Salvar",
    textoCancelar = "Cancelar",
    desabilitado = false,
    varianteSalvar = "contained",
    tipoSalvar = "button",
    iconeSalvar,
    sx,
}: FormActionsProps) {
    return (
        <Stack
            sx={{
                flexDirection: "row",
                gap: layoutTokens.spacing.md,
                justifyContent: "flex-end",
                pt: 1,
                borderTop: "1px solid",
                borderColor: "divider",
                mt: layoutTokens.form.sectionGap,
                px: 1,
                ...sx,
            }}
        >
            <Button
                variant="outlined"
                onClick={onCancelar}
                disabled={salvando || desabilitado}
                sx={{
                    minHeight: 42,
                    fontWeight: 600,
                    borderRadius: layoutTokens.radius.button,
                    px: 2.5,
                    textTransform: "none",
                }}
            >
                {textoCancelar}
            </Button>
            <Button
                variant={varianteSalvar}
                type={tipoSalvar}
                onClick={tipoSalvar === "submit" ? undefined : onSalvar}
                disabled={salvando || desabilitado}
                aria-busy={salvando}
                startIcon={iconeSalvar}
                sx={{
                    minHeight: 42,
                    fontWeight: 600,
                    borderRadius: layoutTokens.radius.button,
                    px: 2.5,
                    textTransform: "none",
                }}
                disableElevation
            >
                {salvando ? "Salvando..." : textoSalvar}
            </Button>
        </Stack>
    );
}