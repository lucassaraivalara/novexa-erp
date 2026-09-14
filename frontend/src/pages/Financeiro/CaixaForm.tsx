import { useEffect, useState } from "react";
import { Alert, Dialog, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { useForm, type SubmitHandler, useWatch } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { listarCaixas, mensagemCaixa, salvarCaixa } from "../../services/caixaService";
import type { CaixaCompleta, CaixaInput } from "../../types/caixa";
import FormActions from "../../components/ui/FormActions";

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
        control,
        reset,
        formState: { errors },
    } = useForm<CaixaInput>({
        resolver: yupResolver(schema),
        defaultValues: { descricao: "" },
        mode: "onBlur",
    });

    const descricao = useWatch({ control, name: "descricao" });

    useEffect(() => {
        if (caixa) {
            reset({ descricao: caixa.descricao });
        } else {
            reset({ descricao: "" });
        }
    }, [caixa, reset]);

    useEffect(() => {
        listarCaixas()
            .then((caixas) => setCaixasExistentes(caixas.map((c) => c.descricao.toLowerCase().trim())))
            .catch((e) => setErro(mensagemCaixa(e, "Não foi possível validar as descrições existentes.")));
    }, []);

    const descricaoNormalizada = (descricao ?? "").toLowerCase().trim();
    const duplicado = caixa
        ? caixasExistentes.some((c) => c === descricaoNormalizada && c !== caixa.descricao.toLowerCase().trim())
        : caixasExistentes.includes(descricaoNormalizada);

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
        <Dialog open fullWidth maxWidth="xs" onClose={salvando ? undefined : onFechar} aria-labelledby="caixa-form-titulo">
            <form onSubmit={handleSubmit(aoSalvar)}>
                <DialogTitle id="caixa-form-titulo">{caixa ? "Editar Caixa" : "Novo Caixa"}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>

                {erro && (
                    <Alert severity="error">
                        {erro}
                    </Alert>
                )}

                <TextField
                    fullWidth
                    required
                    label="Descrição"
                    placeholder="Ex: Caixa Principal, Caixa 01, PDV 02"
                    {...register("descricao")}
                    error={!!(errors.descricao || duplicado)}
                    helperText={errors.descricao?.message || (duplicado ? "Já existe um caixa com esta descrição." : undefined)}
                    autoFocus
                    slotProps={{ htmlInput: { maxLength: 150 } }}
                />

                        <FormActions
                            onCancelar={onFechar}
                            salvando={salvando}
                            tipoSalvar="submit"
                            textoSalvar={caixa ? "Atualizar" : "Criar"}
                            iconeSalvar={<SaveRoundedIcon />}
                            sx={{ mt: 0, px: 0 }}
                        />
                    </Stack>
                </DialogContent>
            </form>
        </Dialog>
    );
}
