import { useEffect, useState } from "react";
import { Alert, Checkbox, Dialog, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography } from "@mui/material";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import FormActions from "../../components/ui/FormActions";
import { mensagemConfiguracaoFormaPagamento, salvarConfiguracaoFormaPagamento } from "../../services/configuracaoFormaPagamentoService";
import { listarContasFinanceiras } from "../../services/contaFinanceiraService";
import type { ConfiguracaoFormaPagamento, ConfiguracaoFormaPagamentoInput, TipoFormaPagamento, FormaPagamentoCatalogo } from "../../types/configuracaoFormaPagamento";
import { rotulosTipoFormaPagamento, tiposFormaPagamentoComContaDestino } from "../../types/configuracaoFormaPagamento";
import type { ContaFinanceira } from "../../types/contaFinanceira";
import { rotulosTipoContaFinanceira } from "../../types/contaFinanceira";

const tiposContaDestinoPermitidos: ContaFinanceira["tipo"][] = ["BANCO", "CARTEIRA_DIGITAL"];

const tiposCatalogo: FormaPagamentoCatalogo[] = [
    { id: 1, tipo: "DINHEIRO", descricao: "Dinheiro" },
    { id: 2, tipo: "PIX", descricao: "PIX" },
    { id: 3, tipo: "DEBITO", descricao: "Débito" },
    { id: 4, tipo: "CREDITO", descricao: "Crédito" },
    { id: 5, tipo: "BOLETO", descricao: "Boleto" },
    { id: 6, tipo: "TRANSFERENCIA", descricao: "Transferência" },
];

const schema = yup.object({
    nomeExibicao: yup.string().trim().required("O nome de exibição é obrigatório.").max(150, "O nome deve ter no máximo 150 caracteres."),
    formaPagamentoId: yup.number().required("O tipo é obrigatório.").oneOf(tiposCatalogo.map((t) => t.id)),
    ativo: yup.boolean().required(),
    contaFinanceiraDestinoId: yup.number().nullable().notRequired(),
}).when("formaPagamentoId", {
    is: (value: number) => {
        const tipo = tiposCatalogo.find((t) => t.id === value)?.tipo;
        return tiposFormaPagamentoComContaDestino.includes(tipo as TipoFormaPagamento);
    },
    then: (schema) => schema.shape({
        contaFinanceiraDestinoId: yup.number().required("A conta financeira destino é obrigatória para este tipo."),
    }),
});

type ConfiguracaoFormaPagamentoFormProps = {
    config: ConfiguracaoFormaPagamento | null;
    onFechar: () => void;
    onSalvo: (config: ConfiguracaoFormaPagamento) => void;
};

export default function ConfiguracaoFormaPagamentoForm({ config, onFechar, onSalvo }: ConfiguracaoFormaPagamentoFormProps) {
    const [erro, setErro] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([]);
    const [carregandoContas, setCarregandoContas] = useState(true);

    const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<ConfiguracaoFormaPagamentoInput>({
        resolver: yupResolver(schema),
        defaultValues: { nomeExibicao: "", formaPagamentoId: 1, ativo: true, contaFinanceiraDestinoId: null },
        mode: "onBlur",
    });

    const formaPagamentoIdSelecionado = watch("formaPagamentoId");
    const tipoSelecionado = tiposCatalogo.find((t) => t.id === formaPagamentoIdSelecionado)?.tipo;
    const exigeContaDestino = tipoSelecionado ? tiposFormaPagamentoComContaDestino.includes(tipoSelecionado) : false;

    useEffect(() => {
        let cancelado = false;
        setCarregandoContas(true);
        listarContasFinanceiras()
            .then((lista) => {
                if (!cancelado) {
                    setContasFinanceiras(lista.filter((c) => c.ativo));
                }
            })
            .catch(() => {
                if (!cancelado) setContasFinanceiras([]);
            })
            .finally(() => {
                if (!cancelado) setCarregandoContas(false);
            });
        return () => { cancelado = true; };
    }, []);

    useEffect(() => {
        if (config) {
            const formaCatalogo = tiposCatalogo.find((t) => t.tipo === config.tipo);
            reset({
                nomeExibicao: config.nomeExibicao,
                formaPagamentoId: formaCatalogo?.id ?? 1,
                ativo: config.ativo,
                contaFinanceiraDestinoId: config.contaFinanceiraDestino?.id ?? null,
            });
        } else {
            reset({ nomeExibicao: "", formaPagamentoId: 1, ativo: true, contaFinanceiraDestinoId: null });
        }
    }, [config, reset]);

    const contasFiltradas = contasFinanceiras.filter((c) => tiposContaDestinoPermitidos.includes(c.tipo));

    const aoSalvar: SubmitHandler<ConfiguracaoFormaPagamentoInput> = async (dados) => {
        setSalvando(true);
        setErro("");
        try {
            onSalvo(await salvarConfiguracaoFormaPagamento(dados, config?.id));
        } catch (e) {
            setErro(mensagemConfiguracaoFormaPagamento(e, "Não foi possível salvar a configuração."));
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Dialog open fullWidth maxWidth="xs" onClose={salvando ? undefined : onFechar} aria-labelledby="config-pagamento-form-titulo">
            <form onSubmit={handleSubmit(aoSalvar)}>
                <DialogTitle id="config-pagamento-form-titulo">{config ? "Editar Configuração de Pagamento" : "Nova Configuração de Pagamento"}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        {erro && <Alert severity="error">{erro}</Alert>}

                        <TextField
                            fullWidth
                            required
                            autoFocus
                            autoComplete="off"
                            label="Nome de exibição"
                            {...register("nomeExibicao")}
                            error={!!errors.nomeExibicao}
                            helperText={errors.nomeExibicao?.message}
                            slotProps={{ htmlInput: { maxLength: 150 } }}
                        />

                        <Controller
                            name="formaPagamentoId"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    fullWidth
                                    required
                                    select
                                    label="Tipo / Forma de pagamento"
                                    error={!!errors.formaPagamentoId}
                                    helperText={errors.formaPagamentoId?.message}
                                    autoComplete="off"
                                    disabled={!!config}
                                >
                                    {tiposCatalogo.map((tipo) => (
                                        <MenuItem key={tipo.id} value={tipo.id}>
                                            {tipo.descricao}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )}
                        />

                        {exigeContaDestino && (
                            <>
                                <Typography variant="body2" color="text.secondary">
                                    Para {rotulosTipoFormaPagamento[tipoSelecionado as TipoFormaPagamento]}, selecione a conta financeira de destino (Banco ou Carteira digital).
                                </Typography>
                                <Controller
                                    name="contaFinanceiraDestinoId"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            required
                                            select
                                            label="Conta financeira destino"
                                            error={!!errors.contaFinanceiraDestinoId}
                                            helperText={carregandoContas ? "Carregando contas..." : errors.contaFinanceiraDestinoId?.message}
                                            autoComplete="off"
                                            disabled={carregandoContas}
                                        >
                                            <MenuItem value="">Selecione uma conta</MenuItem>
                                            {contasFiltradas.map((conta) => (
                                                <MenuItem key={conta.id} value={conta.id}>
                                                    {conta.nome} — {rotulosTipoContaFinanceira[conta.tipo]}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    )}
                                />
                            </>
                        )}

                        {!exigeContaDestino && tipoSelecionado && (
                            <Typography variant="body2" color="text.secondary">
                                O tipo {rotulosTipoFormaPagamento[tipoSelecionado]} não utiliza conta financeira de destino.
                            </Typography>
                        )}

                        <FormControlLabel control={<Checkbox {...register("ativo")} defaultChecked={!config || config.ativo} />} label="Configuração ativa" />
                        <FormActions
                            onCancelar={onFechar}
                            salvando={salvando}
                            tipoSalvar="submit"
                            textoSalvar={config ? "Atualizar" : "Criar"}
                            iconeSalvar={<SaveRoundedIcon />}
                            sx={{ mt: 0, px: 0 }}
                        />
                    </Stack>
                </DialogContent>
            </form>
        </Dialog>
    );
}