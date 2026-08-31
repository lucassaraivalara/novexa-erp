import { Stack, Typography } from "@mui/material";

type PageIntroProps = {
    titulo: string;
    descricao: string;
};

function PageIntro({ titulo, descricao }: PageIntroProps) {
    return (
        <Stack spacing={0.5}>
            <Typography
                variant="h4"
                component="h2"
                sx={{
                    fontSize: { xs: "1.5rem", md: "1.625rem" },
                    fontWeight: 700,
                    lineHeight: 1.2,
                }}
            >
                {titulo}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                {descricao}
            </Typography>
        </Stack>
    );
}

export default PageIntro;
