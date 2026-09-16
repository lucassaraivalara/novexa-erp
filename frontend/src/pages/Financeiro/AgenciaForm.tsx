import { useEffect, useState } from "react";
import { Alert, Checkbox, DialogContent, FormControlLabel, MenuItem, Stack, TextField } from "@mui/material";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import CadastroDialog from "../../components/ui/CadastroDialog";
import { listarBancos, mensagemDadosBancarios, salvarAgencia } from "../../services/dadosBancariosService";
import type { AgenciaInput, AgenciaResumo, BancoResumo } from "../../types/dadosBancarios";

const schema = yup.object({
    bancoId: yup.number().typeError("Selecione um banco.").positive("Selecione um banco.").required("Selecione um banco."),
    numero: yup.string().trim().required("O número é obrigatório.").max(20, "Máximo de 20 caracteres."),
    digito: yup.string().trim().max(5, "Máximo de 5 caracteres.").nullable().defined(),
    contato: yup.string().trim().max(150, "Máximo de 150 caracteres.").nullable().defined(),
    telefone: yup.string().trim().max(20, "Máximo de 20 caracteres.").nullable().defined(),
    cidade: yup.string().trim().max(120, "Máximo de 120 caracteres.").nullable().defined(),
    ativo: yup.boolean().required(),
});

type AgenciaFormProps = {
    agencia: AgenciaResumo | null;
    onFechar: () => void;
    onSalvo: (agencia: AgenciaResumo) => void;
};

export default function AgenciaForm({ agencia, onFechar, onSalvo }: AgenciaFormProps) {
    const [erro, setErro] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [bancos, setBancos] = useState<BancoResumo[]>([]);
    const { register, handleSubmit, reset, control, formState: { errors } } = useForm<AgenciaInput>({
        resolver: yupResolver(schema),
        defaultValues: { bancoId: 0, numero: "", digito: "", contato: "", telefone: "", cidade: "", ativo: true },
        mode: "onBlur",
    });

    useEffect(() => {
        listarBancos()
            .then((dados) => setBancos(dados.filter((b) => b.ativo || b.id === agencia?.bancoId)))
            .catch((e) => setErro(mensagemDadosBancarios(e, "Não foi possível carregar os bancos.")));
    }, [agencia?.bancoId]);

    useEffect(() => {
        reset(agencia
            ? { bancoId: agencia.bancoId, numero: agencia.numero, digito: agencia.digito ?? "", contato: agencia.contato ?? "", telefone: agencia.telefone ?? "", cidade: agencia.cidade ?? "", ativo: agencia.ativo }
            : { bancoId: 0, numero: "", digito: "", contato: "", telefone: "", cidade: "", ativo: true });
    }, [agencia, reset]);

    const aoSalvar: SubmitHandler<AgenciaInput> = async (dados) => {
        setSalvando(true);
        setErro("");
        try {
            onSalvo(await salvarAgencia({
                ...dados,
                digito: dados.digito?.trim() || null,
                contato: dados.contato?.trim() || null,
                telefone: dados.telefone?.trim() || null,
                cidade: dados.cidade?.trim() || null,
            }, agencia?.id));
        } catch (e) {
            setErro(mensagemDadosBancarios(e, "Não foi possível salvar a agência."));
        } finally {
            setSalvando(false);
        }
    };

    return (
        <CadastroDialog
            aberto
            variante="compact"
            titulo={agencia ? "Editar Agência" : "Nova Agência"}
            salvando={salvando}
            textoSalvar={agencia ? "Atualizar" : "Criar"}
            onFechar={onFechar}
            onSubmit={handleSubmit(aoSalvar)}
        >
            <DialogContent sx={{ p: 0 }}>
                <Stack spacing={2}>
                    {erro && <Alert severity="error">{erro}</Alert>}
                    <Controller
                        name="bancoId"
                        control={control}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                select fullWidth required autoFocus size="small"
                                label="Banco"
                                value={field.value || ""}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                error={!!errors.bancoId}
                                helperText={errors.bancoId?.message ?? (bancos.length === 0 ? "Cadastre um banco ativo antes de continuar." : undefined)}
                            >
                                {bancos.map((b) => <MenuItem key={b.id} value={b.id}>{b.nome} — {b.numero}{b.ativo ? "" : " (inativo)"}</MenuItem>)}
                            </TextField>
                        )}
                    />
                    <Stack direction="row" spacing={2}>
                        <TextField
                            fullWidth required size="small"
                            label="Número"
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
                        label="Contato"
                        {...register("contato")}
                        error={!!errors.contato}
                        helperText={errors.contato?.message}
                    />
                    <Stack direction="row" spacing={2}>
                        <TextField
                            fullWidth size="small"
                            label="Telefone"
                            {...register("telefone")}
                            error={!!errors.telefone}
                            helperText={errors.telefone?.message}
                        />
                        <TextField
                            fullWidth size="small"
                            label="Cidade"
                            {...register("cidade")}
                            error={!!errors.cidade}
                            helperText={errors.cidade?.message}
                        />
                    </Stack>
                    <Controller
                        name="ativo"
                        control={control}
                        render={({ field }) => (
                            <FormControlLabel
                                control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                                label="Agência ativa"
                            />
                        )}
                    />
                </Stack>
            </DialogContent>
        </CadastroDialog>
    );
}
