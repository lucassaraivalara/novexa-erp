import { useEffect, useState } from "react";
import { Alert, Checkbox, Dialog, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField } from "@mui/material";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import FormActions from "../../components/ui/FormActions";
import { mensagemFormaPagamento, salvarFormaPagamento } from "../../services/formaPagamentoService";
import type { FormaPagamentoInput, FormaPagamentoResumo, TipoFormaPagamento } from "../../types/formaPagamento";

const tipos: Array<[TipoFormaPagamento, string]> = [
    ["DINHEIRO", "Dinheiro"],
    ["PIX", "PIX"],
    ["DEBITO", "Débito"],
    ["CREDITO", "Crédito"],
    ["BOLETO", "Boleto"],
    ["TRANSFERENCIA", "Transferência"],
];

const schema = yup.object({
    descricao: yup.string().trim().required("A descrição é obrigatória.").max(150, "A descrição deve ter no máximo 150 caracteres."),
    tipo: yup.mixed<TipoFormaPagamento>().oneOf(tipos.map(([valor]) => valor)).required("O tipo é obrigatório."),
    ativo: yup.boolean().required(),
});

type FormaPagamentoFormProps = {
    forma: FormaPagamentoResumo | null;
    onFechar: () => void;
    onSalvo: (forma: FormaPagamentoResumo) => void;
};

export default function FormaPagamentoForm({ forma, onFechar, onSalvo }: FormaPagamentoFormProps) {
    const [erro, setErro] = useState("");
    const [salvando, setSalvando] = useState(false);
    const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormaPagamentoInput>({
        resolver: yupResolver(schema),
        defaultValues: { descricao: "", tipo: "DINHEIRO", ativo: true },
        mode: "onBlur",
    });

    useEffect(() => {
        reset(forma
            ? { descricao: forma.descricao, tipo: forma.tipo as TipoFormaPagamento, ativo: forma.ativo }
            : { descricao: "", tipo: "DINHEIRO", ativo: true });
    }, [forma, reset]);

    const aoSalvar: SubmitHandler<FormaPagamentoInput> = async (dados) => {
        setSalvando(true);
        setErro("");
        try {
            onSalvo(await salvarFormaPagamento(dados, forma?.id));
        } catch (e) {
            setErro(mensagemFormaPagamento(e, "Não foi possível salvar a forma de pagamento."));
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Dialog open fullWidth maxWidth="xs" onClose={salvando ? undefined : onFechar} aria-labelledby="forma-pagamento-form-titulo">
            <form onSubmit={handleSubmit(aoSalvar)}>
                <DialogTitle id="forma-pagamento-form-titulo">{forma ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        {erro && <Alert severity="error">{erro}</Alert>}
                        <TextField
                            fullWidth
                            required
                            autoFocus
                            label="Descrição"
                            {...register("descricao")}
                            error={!!errors.descricao}
                            helperText={errors.descricao?.message}
                            slotProps={{ htmlInput: { maxLength: 150 } }}
                        />
                        <Controller
                            name="tipo"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    fullWidth
                                    required
                                    select
                                    label="Tipo"
                                    error={!!errors.tipo}
                                    helperText={errors.tipo?.message}
                                    disabled={!!forma}
                                >
                                    {tipos.map(([valor, label]) => <MenuItem key={valor} value={valor}>{label}</MenuItem>)}
                                </TextField>
                            )}
                        />
                        <FormControlLabel control={<Checkbox {...register("ativo")} defaultChecked={!forma || forma.ativo} />} label="Forma de pagamento ativa" />
                        <FormActions
                            onCancelar={onFechar}
                            salvando={salvando}
                            tipoSalvar="submit"
                            textoSalvar={forma ? "Atualizar" : "Criar"}
                            iconeSalvar={<SaveRoundedIcon />}
                            sx={{ mt: 0, px: 0 }}
                        />
                    </Stack>
                </DialogContent>
            </form>
        </Dialog>
    );
}
