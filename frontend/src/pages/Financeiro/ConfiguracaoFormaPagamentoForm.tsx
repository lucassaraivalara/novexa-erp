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

const criarSchema = (legadaSemDestino: boolean) => yup.object({
    nomeExibicao: yup.string().trim().required("O nome de exibição é obrigatório.").max(150, "O nome deve ter no máximo 150 caracteres."),
    formaPagamentoId: yup.number().required("O tipo é obrigatório.").oneOf(tiposCatalogo.map((t) => t.id)),
    ativo: yup.boolean().required(),
    contaFinanceiraDestinoId: yup.number().transform((valor, original) => original === "" ? null : valor)
        .nullable().positive("Selecione uma conta financeira válida.").when(["formaPagamentoId", "ativo"], {
            is: (id: number, ativo: boolean) => tiposFormaPagamentoComContaDestino.includes(
                tiposCatalogo.find((t) => t.id === id)?.tipo as TipoFormaPagamento,
            ) && !(legadaSemDestino && !ativo),
            then: (campo) => campo.required("A conta financeira de destino é obrigatória para este tipo."),
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
    const [erroContas, setErroContas] = useState("");
    const legadaSemDestino = Boolean(config && ["DEBITO", "CREDITO"].includes(config.tipo) && !config.contaFinanceiraDestino);

    const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<ConfiguracaoFormaPagamentoInput>({
        resolver: yupResolver(criarSchema(legadaSemDestino)),
        defaultValues: { nomeExibicao: "", formaPagamentoId: 1, ativo: true, contaFinanceiraDestinoId: null },
        mode: "onBlur",
    });

    const formaPagamentoIdSelecionado = watch("formaPagamentoId");
    const tipoSelecionado = tiposCatalogo.find((t) => t.id === formaPagamentoIdSelecionado)?.tipo;
    const exigeContaDestino = tipoSelecionado ? tiposFormaPagamentoComContaDestino.includes(tipoSelecionado) : false;
    const ativo = watch("ativo");

    useEffect(() => {
        let cancelado = false;
        listarContasFinanceiras()
            .then((lista) => {
                if (!cancelado) {
                    setContasFinanceiras(lista.filter((c) => c.ativo));
                }
            })
            .catch((e) => {
                if (!cancelado) setErroContas(mensagemConfiguracaoFormaPagamento(e, "Não foi possível carregar as contas financeiras."));
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
    const destinoAtual = config?.contaFinanceiraDestino;

    const aoSalvar: SubmitHandler<ConfiguracaoFormaPagamentoInput> = async (dados) => {
        setSalvando(true);
        setErro("");
        try {
            onSalvo(await salvarConfiguracaoFormaPagamento({
                nomeExibicao: dados.nomeExibicao,
                formaPagamentoId: dados.formaPagamentoId,
                ativo: dados.ativo,
                contaFinanceiraDestinoId: exigeContaDestino ? dados.contaFinanceiraDestinoId ?? null : null,
            }, config?.id));
        } catch (e) {
            setErro(mensagemConfiguracaoFormaPagamento(e, "Não foi possível salvar a configuração."));
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Dialog open fullWidth maxWidth="xs" onClose={salvando ? undefined : onFechar} aria-labelledby="config-pagamento-form-titulo">
            <form noValidate onSubmit={handleSubmit(aoSalvar)}>
                <DialogTitle id="config-pagamento-form-titulo">{config ? "Editar Configuração de Pagamento" : "Nova Configuração de Pagamento"}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        {erro && <Alert severity="error">{erro}</Alert>}
                        {legadaSemDestino && <Alert severity="warning">
                            Esta configuração de cartão não possui conta financeira de destino. Selecione uma conta para usá-la em novas vendas. É possível inativá-la sem definir destino.
                        </Alert>}

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
                                    onChange={(evento) => {
                                        const id = Number(evento.target.value);
                                        field.onChange(id);
                                        const tipo = tiposCatalogo.find((t) => t.id === id)?.tipo;
                                        if (!tipo || !tiposFormaPagamentoComContaDestino.includes(tipo)) {
                                            setValue("contaFinanceiraDestinoId", null, { shouldValidate: true });
                                        }
                                    }}
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
                                            value={field.value ?? ""}
                                            onChange={(evento) => field.onChange(evento.target.value === "" ? null : Number(evento.target.value))}
                                            fullWidth
                                            required={!(legadaSemDestino && !ativo)}
                                            select
                                            label="Conta Financeira de destino"
                                            error={!!errors.contaFinanceiraDestinoId}
                                            helperText={carregandoContas ? "Carregando contas..." : errors.contaFinanceiraDestinoId?.message}
                                            autoComplete="off"
                                            disabled={carregandoContas}
                                        >
                                            <MenuItem value="">Selecione uma conta</MenuItem>
                                            {destinoAtual && !contasFiltradas.some((conta) => conta.id === destinoAtual.id) && (
                                                <MenuItem value={destinoAtual.id}>{destinoAtual.nome} — {destinoAtual.ativo ? destinoAtual.tipo : "Inativa (vínculo atual)"}</MenuItem>
                                            )}
                                            {contasFiltradas.map((conta) => (
                                                <MenuItem key={conta.id} value={conta.id}>
                                                    {conta.nome} — {rotulosTipoContaFinanceira[conta.tipo]}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    )}
                                />
                                {erroContas && <Alert severity="error">{erroContas}</Alert>}
                                {!carregandoContas && !erroContas && contasFiltradas.length === 0 && (
                                    <Alert severity="info">Nenhuma conta financeira ativa disponível. Cadastre uma Conta Financeira do tipo Banco ou Carteira digital para selecionar um novo destino.</Alert>
                                )}
                            </>
                        )}

                        {!exigeContaDestino && tipoSelecionado && (
                            <Typography variant="body2" color="text.secondary">
                                O tipo {rotulosTipoFormaPagamento[tipoSelecionado]} não utiliza conta financeira de destino.
                            </Typography>
                        )}

                        <Controller name="ativo" control={control} render={({ field }) => (
                            <FormControlLabel control={<Checkbox checked={field.value} onChange={(_, marcado) => field.onChange(marcado)} slotProps={{ input: { ref: field.ref, onBlur: field.onBlur } }} />} label="Configuração ativa" />
                        )} />
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
