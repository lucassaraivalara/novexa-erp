import { Component, Suspense, type ReactNode } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";

class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        if (this.state.failed) return <Alert severity="error" action={
            <Button color="inherit" onClick={() => window.location.reload()}>Recarregar página</Button>
        }>Não foi possível carregar esta tela. Verifique a conexão e recarregue a página. Dados não enviados podem precisar ser informados novamente.</Alert>;
        return this.props.children;
    }
}

export default function RouteContent({ children }: { children: ReactNode }) {
    return <RouteErrorBoundary>
        <Suspense fallback={<Box role="status" aria-live="polite" sx={{ p: 3 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <CircularProgress size={22} aria-label="Carregando tela" />
                <Typography>Carregando tela…</Typography>
            </Stack>
        </Box>}>
            {children}
        </Suspense>
    </RouteErrorBoundary>;
}
