import { useState, type FormEvent } from "react";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Stack,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import type { Produto, ProdutoInput } from "../../types/produto";

type ProdutoFormProps = {
    aberto: boolean;
    produto: Produto | null;
    carregandoProduto: boolean;
    salvando: boolean;
    empresaId: number;
    erroExterno: string;
    onFechar: () => void;
    onSalvar: (dados: ProdutoInput) => Promise<void>;
};

type EstadoFormulario = {
    codigoInterno: string;
    codigoBarras: string;
    nome: string;
    descricao: string;
    unidadeMedida: string;
    precoCusto: string;
    precoVenda: string;
    estoqueAtual: string;
    estoqueMinimo: string;
    controlaEstoque: boolean;
    ativo: boolean;
};

const estadoInicial: EstadoFormulario = {
    codigoInterno: "",
    codigoBarras: "",
    nome: "",
    descricao: "",
    unidadeMedida: "UN",
    precoCusto: "0,00",
    precoVenda: "",
    estoqueAtual: "0,000",
    estoqueMinimo: "0,000",
    controlaEstoque: true,
    ativo: true,
};

function criarEstadoFormulario(produto: Produto | null): EstadoFormulario {
    if (!produto) return estadoInicial;

    return {
        codigoInterno: produto.codigoInterno ?? "",
        codigoBarras: produto.codigoBarras ?? "",
        nome: produto.nome,
        descricao: produto.descricao ?? "",
        unidadeMedida: produto.unidadeMedida,
        precoCusto: numeroParaCampo(produto.precoCusto, 2),
        precoVenda: numeroParaCampo(produto.precoVenda, 2),
        estoqueAtual: numeroParaCampo(produto.estoqueAtual, 3),
        estoqueMinimo: numeroParaCampo(produto.estoqueMinimo, 3),
        controlaEstoque: produto.controlaEstoque,
        ativo: produto.ativo,
    };
}

function numeroParaCampo(valor: number, casas: number): string {
    return Number(valor).toFixed(casas).replace(".", ",");
}

function campoParaNumero(valor: string, maximoCasasDecimais: number): number | null {
    const normalizado = valor.trim().replace(",", ".");

    if (!normalizado || !/^\d+(\.\d+)?$/.test(normalizado)) {
        return null;
    }

    const casasDecimais = normalizado.split(".")[1]?.length ?? 0;
    if (casasDecimais > maximoCasasDecimais) {
        return null;
    }

    const numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : null;
}

function ProdutoForm({
    aberto,
    produto,
    carregandoProduto,
    salvando,
    empresaId,
    erroExterno,
    onFechar,
    onSalvar,
}: ProdutoFormProps) {
    const [formulario, setFormulario] = useState<EstadoFormulario>(() => criarEstadoFormulario(produto));
    const [erros, setErros] = useState<Partial<Record<keyof EstadoFormulario, string>>>({});

    function alterarCampo<K extends keyof EstadoFormulario>(campo: K, valor: EstadoFormulario[K]) {
        setFormulario((atual) => ({ ...atual, [campo]: valor }));
        setErros((atual) => ({ ...atual, [campo]: undefined }));
    }

    function validar(): ProdutoInput | null {
        const novosErros: Partial<Record<keyof EstadoFormulario, string>> = {};
        const precoCusto = campoParaNumero(formulario.precoCusto, 2);
        const precoVenda = campoParaNumero(formulario.precoVenda, 2);
        const estoqueAtual = campoParaNumero(formulario.estoqueAtual, 3);
        const estoqueMinimo = campoParaNumero(formulario.estoqueMinimo, 3);

        if (!formulario.nome.trim()) novosErros.nome = "Informe o nome do produto.";
        if (formulario.nome.trim().length > 150) novosErros.nome = "Use no máximo 150 caracteres.";
        if (!formulario.unidadeMedida.trim()) novosErros.unidadeMedida = "Informe a unidade de medida.";
        if (formulario.unidadeMedida.trim().length > 10) novosErros.unidadeMedida = "Use no máximo 10 caracteres.";
        if (formulario.codigoInterno.length > 60) novosErros.codigoInterno = "Use no máximo 60 caracteres.";
        if (formulario.codigoBarras.length > 60) novosErros.codigoBarras = "Use no máximo 60 caracteres.";
        if (formulario.descricao.length > 2000) novosErros.descricao = "Use no máximo 2000 caracteres.";
        if (precoCusto === null) novosErros.precoCusto = "Use um valor não negativo com até 2 casas decimais.";
        if (precoVenda === null) novosErros.precoVenda = "Use um valor não negativo com até 2 casas decimais.";
        if (estoqueAtual === null) novosErros.estoqueAtual = "Use uma quantidade não negativa com até 3 casas decimais.";
        if (estoqueMinimo === null) novosErros.estoqueMinimo = "Use uma quantidade não negativa com até 3 casas decimais.";

        setErros(novosErros);

        if (
            Object.keys(novosErros).length > 0 ||
            precoCusto === null ||
            precoVenda === null ||
            estoqueAtual === null ||
            estoqueMinimo === null
        ) {
            return null;
        }

        return {
            empresaId,
            codigoInterno: formulario.codigoInterno.trim() || null,
            codigoBarras: formulario.codigoBarras.trim() || null,
            nome: formulario.nome.trim(),
            descricao: formulario.descricao.trim() || null,
            unidadeMedida: formulario.unidadeMedida.trim(),
            precoCusto,
            precoVenda,
            estoqueAtual,
            estoqueMinimo,
            controlaEstoque: formulario.controlaEstoque,
            ativo: formulario.ativo,
        };
    }

    async function enviar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (salvando || carregandoProduto) return;

        const dados = validar();
        if (dados) await onSalvar(dados);
    }

    const editando = produto !== null;

    return (
        <Dialog open={aberto} onClose={salvando ? undefined : onFechar} fullWidth maxWidth="md">
            <Box component="form" onSubmit={enviar} noValidate>
                <DialogTitle sx={{ pb: 1 }}>
                    {editando ? "Editar produto" : "Novo produto"}
                    <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: "0.85rem" }}>
                        {editando
                            ? "Revise os dados e salve as alterações."
                            : "Preencha os dados para cadastrar um produto."}
                    </Typography>
                </DialogTitle>

                <DialogContent dividers>
                    {carregandoProduto ? (
                        <Box sx={{ display: "grid", minHeight: 280, placeItems: "center" }}>
                            <CircularProgress size={32} />
                        </Box>
                    ) : (
                        <Stack spacing={2.25}>
                            {erroExterno && <Alert severity="error">{erroExterno}</Alert>}

                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                                <TextField
                                    label="Código interno"
                                    value={formulario.codigoInterno}
                                    onChange={(e) => alterarCampo("codigoInterno", e.target.value)}
                                    error={Boolean(erros.codigoInterno)}
                                    helperText={erros.codigoInterno ?? "Opcional"}
                                    slotProps={{ htmlInput: { maxLength: 60 } }}
                                />
                                <TextField
                                    label="Código de barras"
                                    value={formulario.codigoBarras}
                                    onChange={(e) => alterarCampo("codigoBarras", e.target.value)}
                                    error={Boolean(erros.codigoBarras)}
                                    helperText={erros.codigoBarras ?? "Opcional"}
                                    slotProps={{ htmlInput: { maxLength: 60 } }}
                                />
                            </Box>

                            <TextField
                                required
                                label="Nome"
                                value={formulario.nome}
                                onChange={(e) => alterarCampo("nome", e.target.value)}
                                error={Boolean(erros.nome)}
                                helperText={erros.nome}
                                slotProps={{ htmlInput: { maxLength: 150 } }}
                            />
                            <TextField
                                label="Descrição"
                                value={formulario.descricao}
                                onChange={(e) => alterarCampo("descricao", e.target.value)}
                                error={Boolean(erros.descricao)}
                                helperText={erros.descricao ?? `${formulario.descricao.length}/2000`}
                                multiline
                                minRows={2}
                                slotProps={{ htmlInput: { maxLength: 2000 } }}
                            />

                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
                                <TextField
                                    required
                                    label="Unidade de medida"
                                    value={formulario.unidadeMedida}
                                    onChange={(e) => alterarCampo("unidadeMedida", e.target.value.toUpperCase())}
                                    error={Boolean(erros.unidadeMedida)}
                                    helperText={erros.unidadeMedida ?? "Ex.: UN, KG, LT"}
                                    slotProps={{ htmlInput: { maxLength: 10 } }}
                                />
                                <TextField
                                    label="Preço de custo"
                                    value={formulario.precoCusto}
                                    onChange={(e) => alterarCampo("precoCusto", e.target.value)}
                                    error={Boolean(erros.precoCusto)}
                                    helperText={erros.precoCusto}
                                    slotProps={{ input: { startAdornment: <Typography sx={{ mr: 1 }}>R$</Typography> } }}
                                />
                                <TextField
                                    required
                                    label="Preço de venda"
                                    value={formulario.precoVenda}
                                    onChange={(e) => alterarCampo("precoVenda", e.target.value)}
                                    error={Boolean(erros.precoVenda)}
                                    helperText={erros.precoVenda}
                                    slotProps={{ input: { startAdornment: <Typography sx={{ mr: 1 }}>R$</Typography> } }}
                                />
                            </Box>

                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                                <TextField
                                    label="Estoque atual"
                                    value={formulario.estoqueAtual}
                                    onChange={(e) => alterarCampo("estoqueAtual", e.target.value)}
                                    error={Boolean(erros.estoqueAtual)}
                                    helperText={erros.estoqueAtual ?? "Até 3 casas decimais"}
                                />
                                <TextField
                                    label="Estoque mínimo"
                                    value={formulario.estoqueMinimo}
                                    onChange={(e) => alterarCampo("estoqueMinimo", e.target.value)}
                                    error={Boolean(erros.estoqueMinimo)}
                                    helperText={erros.estoqueMinimo ?? "Até 3 casas decimais"}
                                />
                            </Box>

                            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0, sm: 3 }}>
                                <FormControlLabel
                                    control={<Switch checked={formulario.controlaEstoque} onChange={(e) => alterarCampo("controlaEstoque", e.target.checked)} />}
                                    label="Controla estoque"
                                />
                                <FormControlLabel
                                    control={<Switch checked={formulario.ativo} onChange={(e) => alterarCampo("ativo", e.target.checked)} />}
                                    label="Produto ativo"
                                />
                            </Stack>
                        </Stack>
                    )}
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={onFechar} disabled={salvando}>Cancelar</Button>
                    <Button type="submit" variant="contained" disabled={salvando || carregandoProduto}>
                        {salvando ? <CircularProgress size={22} color="inherit" /> : editando ? "Salvar alterações" : "Cadastrar produto"}
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
}

export default ProdutoForm;
