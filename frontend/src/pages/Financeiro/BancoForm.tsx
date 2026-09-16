import { useEffect, useState } from "react";
import { Alert, Checkbox, DialogContent, FormControlLabel, Stack, TextField } from "@mui/material";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import CadastroDialog from "../../components/ui/CadastroDialog";
import { mensagemDadosBancarios, salvarBanco } from "../../services/dadosBancariosService";
import type { BancoInput, BancoResumo } from "../../types/dadosBancarios";

const schema = yup.object({
    numero: yup.string().trim().required("O número é obrigatório.").max(10, "Máximo de 10 caracteres."),
    nome: yup.string().trim().required("O nome é obrigatório.").max(150, "Máximo de 150 caracteres."),
    cnab: yup.string().trim().max(10, "Máximo de 10 caracteres.").nullable().defined(),
    ativo: yup.boolean().required(),
});

type BancoFormProps = {
    banco: BancoResumo | null;
    onFechar: () => void;
    onSalvo: (banco: BancoResumo) => void;
};

export default function BancoForm({ banco, onFechar, onSalvo }: BancoFormProps) {
    const [erro, setErro] = useState("");
    const [salvando, setSalvando] = useState(false);
    const { register, handleSubmit, reset, control, formState: { errors } } = useForm<BancoInput>({
        resolver: yupResolver(schema),
        defaultValues: { numero: "", nome: "", cnab: "", ativo: true },
        mode: "onBlur",
    });

    useEffect(() => {
        reset(banco
            ? { numero: banco.numero, nome: banco.nome, cnab: banco.cnab ?? "", ativo: banco.ativo }
            : { numero: "", nome: "", cnab: "", ativo: true });
    }, [banco, reset]);

    const aoSalvar: SubmitHandler<BancoInput> = async (dados) => {
        setSalvando(true);
        setErro("");
        try {
            onSalvo(await salvarBanco({ ...dados, cnab: dados.cnab?.trim() || null }, banco?.id));
        } catch (e) {
            setErro(mensagemDadosBancarios(e, "Não foi possível salvar o banco."));
        } finally {
            setSalvando(false);
        }
    };

    return (
        <CadastroDialog
            aberto
            variante="compact"
            titulo={banco ? "Editar Banco" : "Novo Banco"}
            salvando={salvando}
            textoSalvar={banco ? "Atualizar" : "Criar"}
            onFechar={onFechar}
            onSubmit={handleSubmit(aoSalvar)}
        >
            <DialogContent sx={{ p: 0 }}>
                <Stack spacing={2}>
                    {erro && <Alert severity="error">{erro}</Alert>}
                    <TextField
                        fullWidth required autoFocus size="small"
                        label="Número"
                        {...register("numero")}
                        error={!!errors.numero}
                        helperText={errors.numero?.message}
                        slotProps={{ htmlInput: { maxLength: 10 } }}
                    />
                    <TextField
                        fullWidth required size="small"
                        label="Nome"
                        {...register("nome")}
                        error={!!errors.nome}
                        helperText={errors.nome?.message}
                        slotProps={{ htmlInput: { maxLength: 150 } }}
                    />
                    <TextField
                        fullWidth size="small"
                        label="CNAB"
                        {...register("cnab")}
                        error={!!errors.cnab}
                        helperText={errors.cnab?.message}
                        slotProps={{ htmlInput: { maxLength: 10 } }}
                    />
                    <Controller
                        name="ativo"
                        control={control}
                        render={({ field }) => (
                            <FormControlLabel
                                control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                                label="Banco ativo"
                            />
                        )}
                    />
                </Stack>
            </DialogContent>
        </CadastroDialog>
    );
}
