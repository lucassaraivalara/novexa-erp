import { useState } from "react";
import { Button, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Tooltip } from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import type { ContaReceber } from "../../types/contaReceber";
import { podeCancelarConta, podeReceberConta } from "./contaReceberUtils";
import { podeExecutarAcaoGerencial } from "../../utils/auth/perfis";
import { obterSessao } from "../../utils/auth/sessao";

export type AlvoDetalheReceber = "detalhe" | "historico" | "cancelar";
export type AcoesContaReceberProps = {
    conta: ContaReceber; abrindo: boolean;
    onDetalhe: (conta: ContaReceber, alvo?: AlvoDetalheReceber) => void;
    onReceber: (conta: ContaReceber) => void;
    onEditar: (conta: ContaReceber) => void;
};

export default function ContaReceberAcoes({ conta, abrindo, onDetalhe, onReceber, onEditar }: AcoesContaReceberProps) {
    const [ancora, setAncora] = useState<HTMLElement | null>(null);
    const gerencial = podeExecutarAcaoGerencial(obterSessao()?.perfil);
    const menuId = `acoes-receber-${conta.id}`;
    function detalhe(alvo: AlvoDetalheReceber) { setAncora(null); onDetalhe(conta, alvo); }
    return <Stack onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} direction="row" spacing={0.5} sx={{ alignItems: "center", "& .MuiIconButton-root": {
        width: { xs: 44, sm: 32 }, height: { xs: 44, sm: 32 },
        "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
    } }}>
        <Button size="small" variant="contained" disableElevation disabled={abrindo || !podeReceberConta(conta)}
            onClick={() => onReceber(conta)} sx={{ minWidth: 66, minHeight: { xs: 44, sm: 32 } }}>Receber</Button>
        <Tooltip title="Visualizar detalhes e histórico"><IconButton size="small" aria-label="Consultar histórico" onClick={() => onDetalhe(conta)}><VisibilityOutlinedIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Editar conta manual sem recebimentos"><span><IconButton size="small" aria-label="Editar conta"
            disabled={abrindo || conta.origem !== "MANUAL" || conta.status !== "PENDENTE" || conta.valorRecebido > 0}
            onClick={() => onEditar(conta)}><EditOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Mais ações"><IconButton size="small" aria-label={`Mais ações da conta #${conta.id}`}
            aria-haspopup="menu" aria-controls={ancora ? menuId : undefined} aria-expanded={ancora ? true : undefined}
            onClick={e => setAncora(e.currentTarget)}><MoreVertRoundedIcon fontSize="small" /></IconButton></Tooltip>
        <Menu id={menuId} anchorEl={ancora} open={Boolean(ancora)} onClose={() => setAncora(null)} slotProps={{ list: { "aria-label": "Ações secundárias da conta" } }}>
            <MenuItem disabled={!gerencial || conta.valorRecebido <= 0} onClick={() => detalhe("historico")}>
                <ListItemIcon><UndoRoundedIcon fontSize="small" /></ListItemIcon><ListItemText>Escolher recebimento para estorno</ListItemText>
            </MenuItem>
            <MenuItem disabled={!gerencial || !podeCancelarConta(conta)} onClick={() => detalhe("cancelar")} sx={{ color: "error.main" }}>
                <ListItemIcon sx={{ color: "inherit" }}><CancelOutlinedIcon fontSize="small" /></ListItemIcon><ListItemText>Cancelar conta</ListItemText>
            </MenuItem>
        </Menu>
    </Stack>;
}
