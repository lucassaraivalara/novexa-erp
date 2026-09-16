import { useEffect, useState } from "react";
import { Alert, Checkbox, DialogContent, FormControlLabel, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { Controller, useForm, type Resolver, type SubmitHandler } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import CadastroDialog from "../../components/ui/CadastroDialog";
import { listarAgencias, mensagemDadosBancarios, salvarContaBancaria } from "../../services/dadosBancariosService";
import type { AgenciaResumo, ContaBancariaInput, ContaBancariaResumo, TipoContaBancaria } from "../../types/dadosBancarios";

const tipos: Array<[TipoContaBancaria, string]> = [
    ["CORRENTE", "Conta corrente"],
    ["POUPANCA", "Poupança"],
];

const schema = yup.object({
    agenciaId: yup.number().typeError("Selecione uma agência.").positive("Selecione uma agência.").required("Selecione uma agência."),
    numero: yup.string().trim().required("O número da conta é obrigatório.").max(20, "Máximo de 20 caracteres."),
    digito: yup.string().trim().max(5, "Máximo de 5 caracteres.").nullable().defined(),
    titular: yup.string().trim().max(150, "Máximo de 150 caracteres.").nullable().defined(),
    tipo: yup.mixed<TipoContaBancaria>().oneOf(tipos.map(([valor]) => valor)).required("O tipo é obrigatório."),
    ativo: yup.boolean().required(),
});

type ContaBancariaFormProps = {
    conta: ContaBancariaResumo | null;
    onFechar: () => void;
    onSalvo: (conta: ContaBancariaResumo) => void;
};

export default function ContaBancariaForm({ conta, onFechar, onSalvo }: ContaBancariaFormProps) {
    const [erro, setErro] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [agencias, setAgencias] = useState<AgenciaResumo[]>([]);
    const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<ContaBancariaInput>({
        resolver: yupResolver(schema) as unknown as Resolver<ContaBancariaInput>,
        defaultValues: { agenciaId: 0, numero: "", digito: "", titular: "", tipo: "CORRENTE", ativo: true },
        mode: "onBlur",
    });

    useEffect(() => {
        listarAgencias()
            .then((dados) => setAgencias(dados.filter((a) => a.ativo || a.id === conta?.agenciaId)))
            .catch((e) => setErro(mensagemDadosBancarios(e, "Não foi possível carregar as agências.")));
    }, [conta?.agenciaId]);

    useEffect(() => {
        reset(conta
            ? { agenciaId: conta.agenciaId, numero: conta.numero, digito: conta.digito ?? "", titular: conta.titular ?? "", tipo: conta.tipo, ativo: conta.ativo }
            : { agenciaId: 0, numero: "", digito: "", titular: "", tipo: "CORRENTE", ativo: true });
    }, [conta, reset]);

    const agenciaSelecionada = agencias.find((a) => a.id === watch("agenciaId"));

    const aoSalvar: SubmitHandler<ContaBancariaInput> = async (dados) => {
        setSalvando(true);
        setErro("");
        try {
            onSalvo(await salvarContaBancaria({
                ...dados,
                digito: dados.digito?.trim() || null,
                titular: dados.titular?.trim() || null,
            }, conta?.id));
        } catch (e) {
            setErro(mensagemDadosBancarios(e, "Não foi possível salvar a conta bancária."));
        } finally {
            setSalvando(false);
        }
    };

    return (
        <CadastroDialog
            aberto
            variante="compact"
            titulo={conta ? "Editar Conta Bancária" : "Nova Conta Bancária"}
            salvando={salvando}
            textoSalvar={conta ? "Atualizar" : "Criar"}
            onFechar={onFechar}
            onSubmit={handleSubmit(aoSalvar)}
        >
            <DialogContent sx={{ p: 0 }}>
                <Stack spacing={2}>
                    {erro && <Alert severity="error">{erro}</Alert>}
                    <Controller
                        name="agenciaId"
                        control={control}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                select fullWidth required autoFocus size="small"
                                label="Agência"
                                value={field.value || ""}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                error={!!errors.agenciaId}
                                helperText={errors.agenciaId?.message ?? (agencias.length === 0 ? "Cadastre uma agência ativa antes de continuar." : undefined)}
                            >
                                {agencias.map((a) => <MenuItem key={a.id} value={a.id}>{a.bancoNome} — {a.numero}{a.ativo ? "" : " (inativa)"}</MenuItem>)}
                            </TextField>
                        )}
                    />
                    {agenciaSelecionada && (
                        <Typography variant="body2" color="text.secondary">Banco: <strong>{agenciaSelecionada.bancoNome}</strong></Typography>
                    )}
                    <Stack direction="row" spacing={2}>
                        <TextField
                            fullWidth required size="small"
                            label="Número da conta"
                            {...register("numero")}
                            error={!!errors.numero}
                            helperText={errors.numero?.message}
                        />
                        <TextField
                            fullWidth size="small"
                            label="Dígito"
                            {...register("digito")}
                            error={!!errors.digito}
                            helperText={errors.digito?.message}
                        />
                    </Stack>
                    <TextField
                        fullWidth size="small"
                        label="Titular"
                        {...register("titular")}
                        error={!!errors.titular}
                        helperText={errors.titular?.message}
                    />
                    <Controller
                        name="tipo"
                        control={control}
                        render={({ field }) => (
                            <TextField {...field} select fullWidth required size="small" label="Tipo" error={!!errors.tipo} helperText={errors.tipo?.message}>
                                {tipos.map(([valor, label]) => <MenuItem key={valor} value={valor}>{label}</MenuItem>)}
                            </TextField>
                        )}
                    />
                    <Controller
                        name="ativo"
                        control={control}
                        render={({ field }) => (
                            <FormControlLabel
                                control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                                label="Conta ativa"
                            />
                        )}
                    />
                </Stack>
            </DialogContent>
        </CadastroDialog>
    );
}
