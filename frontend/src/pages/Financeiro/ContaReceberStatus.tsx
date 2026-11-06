import { Box } from "@mui/material";
import StatusChip from "../../components/ui/StatusChip";
import type { ContaReceber } from "../../types/contaReceber";
import { hoje, rotulosStatus } from "./contaReceberUtils";

export default function ContaReceberStatus({ conta }: { conta: ContaReceber }) {
    const vencida = (conta.status === "PENDENTE" || conta.status === "PARCIAL") && conta.dataVencimento < hoje();
    return <Box component="span" sx={{ "& .MuiChip-root": { height: 28, fontWeight: 600 } }}>
        <StatusChip status={vencida ? "VENCIDA" : conta.status === "CANCELADA" ? "INATIVA" : conta.status}
            label={rotulosStatus[conta.status] + (vencida ? " · Vencida" : "")} />
    </Box>;
}
