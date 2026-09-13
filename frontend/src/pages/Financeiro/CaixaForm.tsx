import { useEffect, useState } from "react";
import { Alert, Box, Button, IconButton, Stack, TextField, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { useForm, type SubmitHandler } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { listarCaixas, mensagemCaixa, salvarCaixa } from "../../services/caixaService";
import type { CaixaCompleta, CaixaInput } from "../../types/caixa";

const schema = yup.object().shape({
    descricao: yup.string().required("A descrição do caixa é obrigatória.").max(150, "A descrição deve ter no máximo 150 caracteres."),
});

interface CaixaFormProps {
    caixa: CaixaCompleta | null;
    onFechar: () => void;
    onSalvo: (caixa: CaixaCompleta) => void;
}

export default function CaixaForm({ caixa, onFechar, onSalvo }: CaixaFormProps) {
    const [erro, setErro] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [caixasExistentes, setCaixasExistentes] = useState<string[]>([]);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<CaixaInput>({
        resolver: yupResolver(schema),
        defaultValues: { descricao: "" },
        mode: "onBlur",
    });

    const descricao = watch("descricao");

    useEffect(() => {
        if (caixa) {
            setValue("descricao", caixa.descricao);
            setErro("");
        } else {
            setValue("descricao", "");
            setErro("");
        }
    }, [caixa, setValue]);

    useEffect(() => {
        listarCaixas()
            .then((caixas) => setCaixasExistentes(caixas.map((c) => c.descricao.toLowerCase().trim())))
            .catch(() => {});
    }, []);

    const duplicado = caixa
        ? caixasExistentes.some((c) => c === descricao.toLowerCase().trim() && c !== caixa.descricao.toLowerCase().trim())
        : caixasExistentes.includes(descricao.toLowerCase().trim());

    const aoSalvar: SubmitHandler<CaixaInput> = async (dados) => {
        setSalvando(true);
        setErro("");
        try {
            const salvo = await salvarCaixa(dados, caixa?.id);
            onSalvo(salvo);
        } catch (e) {
            setErro(mensagemCaixa(e, "Não foi possível salvar o caixa."));
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Box
            component="form"
            onSubmit={handleSubmit(aoSalvar)}
            sx={{ maxWidth: 480, mx: "auto", width: "100%", p: { xs: 2, sm: 3 }, bgcolor: "background.paper", borderRadius: 2, boxShadow: 3 }}
        >
            <Stack spacing={2} sx={{ width: "100%" }}>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
                        {caixa ? "Editar Caixa" : "Novo Caixa"}
                    </Typography>
                    <IconButton onClick={onFechar} aria-label="Fechar" size="small" sx={{ ml: "auto" }}>
                        <CloseRoundedIcon />
                    </IconButton>
                </Stack>

                {erro && (
                    <Alert severity="error" sx={{ mb: 1 }}>
                        {erro}
                    </Alert>
                )}

                <TextField
                    fullWidth
                    label="Descrição"
                    placeholder="Ex: Caixa Principal, Caixa 01, PDV 02"
                    {...register("descricao")}
                    error={!!(errors.descricao || duplicado)}
                    helperText={errors.descricao?.message || (duplicado ? "Já existe um caixa com esta descrição." : undefined)}
                    autoFocus
                    slotProps={{ htmlInput: { maxLength: 150 } }}
                />

                <Stack direction="row" spacing={2} sx={{ mt: 1, justifyContent: "flex-end" }}>
                    <Button variant="outlined" onClick={onFechar} disabled={salvando}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={salvando}
                        startIcon={<SaveRoundedIcon />}
                    >
                        {salvando ? "Salvando..." : caixa ? "Atualizar" : "Criar"}
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
}
