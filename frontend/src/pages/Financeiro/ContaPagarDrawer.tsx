import { useEffect, useState, type FormEvent } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Alert, Autocomplete, Box, Button, Drawer, IconButton, Stack, TextField, Typography } from "@mui/material";
import { mensagemContaPagar, salvarContaPagar } from "../../services/contaPagarService";
import { buscarFornecedores } from "../../services/fornecedorService";
import type { ContaPagar, ContaPagarInput } from "../../types/contaPagar";

type OpcaoFornecedor = { id: number; razaoSocial: string };

type Props = {
    conta: ContaPagar | null;
    onFechar: () => void;
    onSalvo: (conta: ContaPagar) => void;
};

export default function ContaPagarDrawer({ conta, onFechar, onSalvo }: Props) {
    const [form, setForm] = useState({
        descricao: conta?.descricao ?? "",
        documento: conta?.documento ?? "",
        fornecedorId: (conta?.fornecedorId ?? "") as number | "",
        categoria: conta?.categoria ?? "",
        dataEmissao: conta?.dataEmissao ?? "",
        dataVencimento: conta?.dataVencimento ?? "",
        valor: conta ? String(conta.valor).replace(".", ",") : "",
        observacao: conta?.observacao ?? "",
    });
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    // O fornecedor já vinculado permanece selecionável mesmo se estiver inativo.
    const [fornecedor, setFornecedor] = useState<OpcaoFornecedor | null>(
        conta?.fornecedorId ? { id: conta.fornecedorId, razaoSocial: conta.fornecedorNome ?? `Fornecedor #${conta.fornecedorId}` } : null);
    const [termo, setTermo] = useState("");
    const [opcoes, setOpcoes] = useState<OpcaoFornecedor[]>([]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            buscarFornecedores(termo, controller.signal)
                .then((lista) => { if (!controller.signal.aborted) setOpcoes(lista); })
                .catch(() => { if (!controller.signal.aborted) setOpcoes([]); });
        }, termo ? 300 : 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [termo]);

    const opcoesVisiveis = fornecedor && !opcoes.some((item) => item.id === fornecedor.id) ? [fornecedor, ...opcoes] : opcoes;

    async function enviar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (salvando) return;
        const valor = Number(form.valor.replace(",", "."));
        if (!Number.isFinite(valor) || valor <= 0 || Math.abs(valor * 100 - Math.round(valor * 100)) > 0.000001) {
            setErro("Informe um valor positivo com até duas casas decimais.");
            return;
        }
        const dados: ContaPagarInput = {
            descricao: form.descricao.trim(), documento: form.documento.trim() || null,
            fornecedorId: form.fornecedorId || null,
            categoria: form.categoria.trim() || null, dataEmissao: form.dataEmissao || null,
            dataVencimento: form.dataVencimento, valor, observacao: form.observacao.trim() || null,
        };
        setSalvando(true); setErro("");
        try { onSalvo(await salvarContaPagar(dados, conta?.id)); }
        catch (e) { setErro(mensagemContaPagar(e, "Não foi possível salvar a conta.")); }
        finally { setSalvando(false); }
    }

    return <Drawer anchor="right" open onClose={salvando ? undefined : onFechar}
        slotProps={{ paper: { "aria-labelledby": "conta-pagar-drawer-titulo", sx: { width: { xs: "100%", sm: 500 }, maxWidth: "100vw" } } }}>
        <Box component="form" onSubmit={(e) => void enviar(e)} sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 3, py: 2, borderBottom: 1, borderColor: "divider" }}>
                <Typography id="conta-pagar-drawer-titulo" variant="h6" component="h2">{conta ? "Editar conta" : "Nova conta a pagar"}</Typography>
                <IconButton aria-label="Fechar formulário" onClick={onFechar} disabled={salvando}><CloseRoundedIcon /></IconButton>
            </Stack>
            <Stack spacing={2} sx={{ p: 3, overflowY: "auto", flex: 1 }}>
                {erro && <Alert severity="error">{erro}</Alert>}
                <TextField autoFocus required fullWidth label="Descrição" name="descricao" value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })} slotProps={{ htmlInput: { maxLength: 200 } }} />
                <TextField fullWidth label="Número do documento" name="documento" value={form.documento}
                    onChange={(e) => setForm({ ...form, documento: e.target.value })} slotProps={{ htmlInput: { maxLength: 80 } }} />
                <Autocomplete options={opcoesVisiveis} value={fornecedor} filterOptions={(lista) => lista}
                    getOptionLabel={(item) => item.razaoSocial} isOptionEqualToValue={(a, b) => a.id === b.id}
                    noOptionsText="Nenhum fornecedor ativo encontrado"
                    onInputChange={(_, texto, motivo) => { if (motivo === "input") setTermo(texto); }}
                    onChange={(_, item) => { setFornecedor(item); setForm({ ...form, fornecedorId: item?.id ?? "" }); }}
                    renderInput={(params) => <TextField {...params} label="Fornecedor" name="fornecedorId" placeholder="Sem fornecedor" />} />
                <TextField fullWidth label="Categoria" name="categoria" value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })} slotProps={{ htmlInput: { maxLength: 100 } }} />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField fullWidth label="Emissão" name="dataEmissao" type="date" value={form.dataEmissao}
                        onChange={(e) => setForm({ ...form, dataEmissao: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                    <TextField fullWidth required label="Vencimento" name="dataVencimento" type="date" value={form.dataVencimento}
                        onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                </Stack>
                <TextField fullWidth required label="Valor (R$)" name="valor" value={form.valor} slotProps={{ htmlInput: { inputMode: "decimal" } }}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })} />
                <TextField fullWidth multiline minRows={3} label="Observação" name="observacao" value={form.observacao}
                    onChange={(e) => setForm({ ...form, observacao: e.target.value })} slotProps={{ htmlInput: { maxLength: 1000 } }} />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", px: 3, py: 2, borderTop: 1, borderColor: "divider" }}>
                <Button onClick={onFechar} disabled={salvando}>Cancelar</Button>
                <Button type="submit" variant="contained" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
            </Stack>
        </Box>
    </Drawer>;
}
