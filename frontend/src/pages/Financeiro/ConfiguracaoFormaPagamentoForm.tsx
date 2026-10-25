import CampoTexto from "../../components/ui/CampoTexto";
import { numeroDecimal } from "../../utils/numeroFormulario";
import { useEffect, useState } from "react";
import { Alert, Button, Checkbox, Dialog, DialogContent, DialogTitle, FormControlLabel, Link, MenuItem, Stack, Typography } from "@mui/material";
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
import CampoDecimal, { CampoMonetario, CampoPercentual } from "../../components/ui/CampoDecimal";

const tiposContaDestinoPermitidos: ContaFinanceira["tipo"][] = ["BANCO", "CARTEIRA_DIGITAL"];

const tiposCatalogo: FormaPagamentoCatalogo[] = [
    { id: 1, tipo: "DINHEIRO", descricao: "Dinheiro" },
    { id: 2, tipo: "PIX", descricao: "PIX" },
    { id: 3, tipo: "DEBITO", descricao: "Débito" },
    { id: 4, tipo: "CREDITO", descricao: "Crédito" },
    { id: 5, tipo: "BOLETO", descricao: "Boleto" },
    { id: 6, tipo: "TRANSFERENCIA", descricao: "Transferência" },
];

const ehTipoCartao = (id: number) => {
    const tipo = tiposCatalogo.find((item) => item.id === id)?.tipo;
    return tipo === "DEBITO" || tipo === "CREDITO";
};

const numeroOpcional = () => yup.number().transform((valor, original) => {
    if (original === "" || original === null || original === undefined) return null;
    if (typeof original !== "string") return valor;
    const texto = original.trim();
    return /^-?\d+(?:[.,]\d*)?$/.test(texto) ? Number(texto.replace(",", ".")) : Number.NaN;
}).nullable();

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
    taxaPercentual: numeroOpcional().when("formaPagamentoId", {
        is: ehTipoCartao,
        then: (campo) => campo.min(0, "A taxa percentual não pode ser negativa.")
            .max(100, "A taxa percentual não pode ultrapassar 100%.").typeError("Informe uma taxa percentual válida.")
            .test("precisao", "Informe a taxa com até quatro casas decimais.", (v, c) => v == null || numeroDecimal(String(c.originalValue), 4) !== null),
        otherwise: campo => campo.transform(() => null),
    }),
    taxaFixa: numeroOpcional().when("formaPagamentoId", {
        is: ehTipoCartao,
        then: (campo) => campo.min(0, "A taxa fixa não pode ser negativa.").typeError("Informe uma taxa fixa válida.")
            .test("precisao", "Informe a taxa fixa com até duas casas decimais.", (v, c) => v == null || numeroDecimal(String(c.originalValue), 2) !== null),
        otherwise: campo => campo.transform(() => null),
    }),
    prazoRecebimentoDias: numeroOpcional().when("formaPagamentoId", {
        is: ehTipoCartao,
        then: (campo) => campo.integer("O prazo deve ser um número inteiro.")
            .min(0, "O prazo não pode ser negativo.").typeError("Informe um prazo válido.")
            .test("inteiro", "Informe um prazo válido.", (v, c) => v == null || numeroDecimal(String(c.originalValue), 0) !== null),
        otherwise: campo => campo.transform(() => null),
    }),
    maximoParcelasConsumidor: numeroOpcional().when("formaPagamentoId", {
        is: 4,
        then: campo => campo.required("Informe o máximo de parcelas do consumidor.")
            .integer("Informe um número inteiro de parcelas.").min(1, "Informe de 1 a 12 parcelas.").max(12, "Informe de 1 a 12 parcelas.")
            .typeError("Informe um número inteiro de parcelas.")
            .test("inteiro", "Informe um número inteiro de parcelas.", (v, c) => v == null || numeroDecimal(String(c.originalValue), 0) !== null),
        otherwise: campo => campo.transform(() => null),
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
    const [tentativaContas, setTentativaContas] = useState(0);
    const legadaSemDestino = Boolean(config && ["DEBITO", "CREDITO"].includes(config.tipo) && !config.contaFinanceiraDestino);

    const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<ConfiguracaoFormaPagamentoInput>({
        resolver: yupResolver(criarSchema(legadaSemDestino)),
        defaultValues: { nomeExibicao: "", formaPagamentoId: 1, ativo: true, contaFinanceiraDestinoId: null,
            taxaPercentual: 0, taxaFixa: 0, prazoRecebimentoDias: 0, maximoParcelasConsumidor: 1 },
        mode: "onBlur",
    });

    const formaPagamentoIdSelecionado = watch("formaPagamentoId");
    const tipoSelecionado = tiposCatalogo.find((t) => t.id === formaPagamentoIdSelecionado)?.tipo;
    const exigeContaDestino = tipoSelecionado ? tiposFormaPagamentoComContaDestino.includes(tipoSelecionado) : false;
    const ehCartao = tipoSelecionado === "DEBITO" || tipoSelecionado === "CREDITO";
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
    }, [tentativaContas]);

    function atualizarDestinos() {
        setCarregandoContas(true);
        setErroContas("");
        setTentativaContas((valor) => valor + 1);
    }

    useEffect(() => {
        if (config) {
            const formaCatalogo = tiposCatalogo.find((t) => t.tipo === config.tipo);
            reset({
                nomeExibicao: config.nomeExibicao,
                formaPagamentoId: formaCatalogo?.id ?? 1,
                ativo: config.ativo,
                contaFinanceiraDestinoId: config.contaFinanceiraDestino?.id ?? null,
                taxaPercentual: config.taxaPercentual ?? null,
                taxaFixa: config.taxaFixa ?? null,
                prazoRecebimentoDias: config.prazoRecebimentoDias ?? null,
                maximoParcelasConsumidor: config.maximoParcelasConsumidor ?? 1,
            });
        } else {
            reset({ nomeExibicao: "", formaPagamentoId: 1, ativo: true, contaFinanceiraDestinoId: null,
                taxaPercentual: 0, taxaFixa: 0, prazoRecebimentoDias: 0, maximoParcelasConsumidor: 1 });
        }
    }, [config, reset]);

    const contasFiltradas = contasFinanceiras.filter((c) => tiposContaDestinoPermitidos.includes(c.tipo));
    const destinoAtual = config?.contaFinanceiraDestino;

    const aoSalvar: SubmitHandler<ConfiguracaoFormaPagamentoInput> = async (dados) => {
        setSalvando(true);
        setErro("");
        try {
            const payload: ConfiguracaoFormaPagamentoInput = {
                nomeExibicao: dados.nomeExibicao,
                formaPagamentoId: dados.formaPagamentoId,
                ativo: dados.ativo,
                contaFinanceiraDestinoId: exigeContaDestino ? dados.contaFinanceiraDestinoId ?? null : null,
            };
            if (ehCartao) {
                if (dados.taxaPercentual != null) payload.taxaPercentual = dados.taxaPercentual;
                if (dados.taxaFixa != null) payload.taxaFixa = dados.taxaFixa;
                if (dados.prazoRecebimentoDias != null) payload.prazoRecebimentoDias = dados.prazoRecebimentoDias;
            }
            if (tipoSelecionado === "CREDITO") payload.maximoParcelasConsumidor = dados.maximoParcelasConsumidor;
            onSalvo(await salvarConfiguracaoFormaPagamento(payload, config?.id));
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

                        <CampoTexto placeholder="Ex.: Crédito da loja…"
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
                                <CampoTexto
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
                                </CampoTexto>
                            )}
                        />

                        {exigeContaDestino && (
                            <>
                                <Typography variant="body2" color="text.secondary">
                                    {ehCartao ? "Destino da liquidação dos recebíveis de cartão." : "Destino financeiro do recebimento."} A conta é cadastrada em Contas e saldos (Banco ou Carteira digital).
                                </Typography>
                                <Controller
                                    name="contaFinanceiraDestinoId"
                                    control={control}
                                    render={({ field }) => (
                                        <CampoTexto
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
                                        </CampoTexto>
                                    )}
                                />
                                {erroContas && <Alert severity="error" action={<Button type="button" color="inherit" size="small" onClick={atualizarDestinos}>Tentar novamente</Button>}>{erroContas}</Alert>}
                                {!carregandoContas && !erroContas && contasFiltradas.length === 0 && (
                                    <Alert severity="info">
                                        Nenhuma conta financeira ativa disponível. Cadastre uma conta do tipo Banco ou Carteira digital em{' '}
                                        <Link href="/financeiro/contas-financeiras" target="_blank" rel="noopener noreferrer">Contas e saldos (nova aba)</Link>.
                                        <Button type="button" size="small" onClick={atualizarDestinos}>Atualizar destinos</Button>
                                    </Alert>
                                )}
                                {ehCartao && <>
                                    {tipoSelecionado === "CREDITO" && <Controller name="maximoParcelasConsumidor" control={control} render={({ field }) => (
                                        <CampoDecimal {...field} inputRef={field.ref} canonico casas={0} minimo={1} maximo={12} passo="1" value={String(field.value ?? "")} fullWidth autoComplete="off"
                                            label="Máximo de parcelas do consumidor" error={!!errors.maximoParcelasConsumidor}
                                            onValueChange={v => field.onChange(v === "" ? null : v)}
                                            helperText={errors.maximoParcelasConsumidor?.message ?? "1 permite apenas crédito à vista. Não altera taxas nem o prazo de recebimento da empresa."}
                                            />
                                    )} />}
                                    <Controller name="taxaPercentual" control={control} render={({ field }) => (
                                        <CampoPercentual {...field} inputRef={field.ref} canonico casas={4} maximo={100} value={String(field.value ?? "")}
                                            onValueChange={v => field.onChange(v === "" ? null : v)}
                                            fullWidth label="Taxa percentual (%)" error={!!errors.taxaPercentual}
                                            helperText={errors.taxaPercentual?.message}
                                            placeholder="Ex.: 3,0000…" />
                                    )} />
                                    <Controller name="taxaFixa" control={control} render={({ field }) => (
                                        <CampoMonetario {...field} inputRef={field.ref} canonico value={String(field.value ?? "")}
                                            onValueChange={v => field.onChange(v === "" ? null : v)}
                                            fullWidth label="Taxa fixa (R$)" error={!!errors.taxaFixa}
                                            helperText={errors.taxaFixa?.message}
                                            placeholder="Ex.: 1,25…" />
                                    )} />
                                    <Controller name="prazoRecebimentoDias" control={control} render={({ field }) => (
                                        <CampoDecimal {...field} inputRef={field.ref} canonico casas={0} value={String(field.value ?? "")}
                                            onValueChange={v => field.onChange(v === "" ? null : v)}
                                            fullWidth label="Prazo de recebimento (dias)" error={!!errors.prazoRecebimentoDias}
                                            helperText={errors.prazoRecebimentoDias?.message}
                                            placeholder="Ex.: 1…" />
                                    )} />
                                </>}
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
