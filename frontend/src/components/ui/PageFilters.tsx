import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
    CircularProgress,
    InputAdornment,
    Paper,
    Stack,
    TextField,
} from "@mui/material";
import type { KeyboardEvent, ReactNode } from "react";
import { layoutTokens } from "../layout/layoutTokens";

export interface BuscaPagina {
    placeholder: string;
    onChange: (valor: string) => void;
    valor: string;
    carregando?: boolean;
    onKeyDown?: (evento: KeyboardEvent<HTMLInputElement>) => void;
}

interface PageFiltersProps {
    busca?: BuscaPagina;
    children?: ReactNode;
}

export default function PageFilters({ busca, children }: PageFiltersProps) {
    return (
        <Paper component="section" aria-label="Filtros da página" variant="outlined" sx={{ px: { xs: 1.5, md: 2 }, py: 1.25 }}>
            <Stack
                sx={{
                    flexDirection: { xs: "column", sm: "row" },
                    alignItems: { xs: "stretch", sm: "center" },
                    gap: 1.5,
                    flexWrap: "wrap",
                }}
            >
                {busca && (
                    <TextField
                        fullWidth
                        size="small"
                        placeholder={busca.placeholder}
                        value={busca.valor}
                        onChange={(evento) => busca.onChange(evento.target.value)}
                        onKeyDown={busca.onKeyDown}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchRoundedIcon fontSize="small" color="action" />
                                    </InputAdornment>
                                ),
                                endAdornment: busca.carregando
                                    ? <CircularProgress size={18} aria-label="Pesquisando" />
                                    : undefined,
                            },
                        }}
                        sx={{
                            flex: "1 1 320px",
                            minWidth: { xs: 0, sm: 280 },
                            "& .MuiOutlinedInput-root": {
                                borderRadius: layoutTokens.radius.field,
                            },
                        }}
                    />
                )}
                {children}
            </Stack>
        </Paper>
    );
}
