import { Alert, Box, Paper, Stack, Typography } from "@mui/material";
import PageIntro from "../../components/layout/PageIntro";
import { obterEmpresaAtiva } from "../../utils/auth/sessao";

type CampoEmpresaProps = {
    titulo: string;
    valor: string | boolean;
};

function CampoEmpresa({ titulo, valor }: CampoEmpresaProps) {
    const texto = typeof valor === "boolean" ? (valor ? "Ativa" : "Inativa") : valor || "Não informado";

    return (
        <Box>
            <Typography color="text.secondary" sx={{ fontSize: "0.75rem", fontWeight: 600 }}>
                {titulo}
            </Typography>
            <Typography sx={{ mt: 0.25, fontSize: "0.875rem", fontWeight: 600 }}>
                {texto}
            </Typography>
        </Box>
    );
}

function Empresa() {
    const empresa = obterEmpresaAtiva();

    if (!empresa) {
        return (
            <Stack spacing={2.5}>
                <PageIntro
                    titulo="Empresa"
                    descricao="Confira os dados da empresa ativa no seu acesso."
                />
                <Alert severity="warning">
                    Não foi encontrada uma empresa ativa nesta sessão. Entre novamente no sistema.
                </Alert>
            </Stack>
        );
    }

    return (
        <Stack spacing={2.5}>
            <PageIntro
                titulo="Empresa"
                descricao="Dados da empresa vinculada ao seu usuário."
            />

            <Paper
                variant="outlined"
                sx={{
                    maxWidth: 760,
                    p: { xs: 2, sm: 2.5 },
                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.04)",
                }}
            >
                <Stack spacing={2.5}>
                    <Box>
                        <Typography sx={{ fontSize: "1rem", fontWeight: 700 }}>
                            {empresa.nomeFantasia}
                        </Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.25, fontSize: "0.875rem" }}>
                            {empresa.razaoSocial}
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                            gap: 2,
                        }}
                    >
                        <CampoEmpresa titulo="CNPJ" valor={empresa.cnpj} />
                        <CampoEmpresa titulo="Inscrição estadual" valor={empresa.inscricaoEstadual} />
                        <CampoEmpresa titulo="E-mail" valor={empresa.email} />
                        <CampoEmpresa titulo="Telefone" valor={empresa.telefone} />
                        <CampoEmpresa titulo="Endereço" valor={empresa.endereco} />
                        <CampoEmpresa titulo="Status" valor={empresa.ativo} />
                    </Box>
                </Stack>
            </Paper>
        </Stack>
    );
}

export default Empresa;
