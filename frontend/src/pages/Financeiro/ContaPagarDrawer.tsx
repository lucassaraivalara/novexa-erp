import { numeroDecimal } from "../../utils/numeroFormulario";
import CampoTexto from "../../components/ui/CampoTexto";
import { CampoMonetario } from "../../components/ui/CampoDecimal";
import { useState, type FormEvent } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Alert, Box, Button, Drawer, IconButton, Link, Stack, Typography } from "@mui/material";
import FornecedorAutocomplete, { type FornecedorOpcao } from "../../components/fornecedores/FornecedorAutocomplete";
import { mensagemContaPagar, salvarContaPagar } from "../../services/contaPagarService";
import type { ContaPagar, ContaPagarInput } from "../../types/contaPagar";

type Props = {
    conta: ContaPagar | null;
    onFechar: () => void;
    onSalvo: (conta: ContaPagar) => void;
    somenteLeitura?: boolean;
};

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function ContaPagarDrawer({ conta, onFechar, onSalvo, somenteLeitura = false }: Props) {
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
    const [fornecedor, setFornecedor] = useState<FornecedorOpcao | null>(
        conta?.fornecedorId ? { id: conta.fornecedorId, razaoSocial: conta.fornecedorNome ?? `Fornecedor #${conta.fornecedorId}` } : null);

    async function enviar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (salvando || somenteLeitura) return;
        const valor = numeroDecimal(form.valor, 2);
        if (valor === null || valor <= 0 || Math.abs(valor * 100 - Math.round(valor * 100)) > 0.000001) {
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
                <Typography id="conta-pagar-drawer-titulo" variant="h6" component="h2">{somenteLeitura ? `Conta a pagar #${conta?.id}` : conta ? "Editar conta" : "Nova conta a pagar"}</Typography>
                <IconButton aria-label="Fechar formulário" onClick={onFechar} disabled={salvando}><CloseRoundedIcon /></IconButton>
            </Stack>
            <Stack spacing={2} sx={{ p: 3, overflowY: "auto", flex: 1 }}>
                {erro && <Alert severity="error">{erro}</Alert>}
                {conta?.entradaMercadoriaId && <Alert severity="info">
                    {conta.origemVinculoEntrada === "GERADA" ? "Conta gerada pela entrada. Cancele a obrigação pela origem." : "Conta preexistente vinculada à entrada."}{' '}
                    <Link href={`/estoque?aba=entradas&entradaId=${conta.entradaMercadoriaId}`} target="_blank" rel="noopener noreferrer">Abrir entrada #{conta.entradaMercadoriaId} (nova aba)</Link>
                </Alert>}
                {somenteLeitura && conta && <Typography variant="body2">Situação: {conta.status === "PAGA" ? "Paga" : conta.status === "ABERTA" ? "Aberta" : "Cancelada"}</Typography>}
                {somenteLeitura && conta?.movimentacaoFinanceiraId && <Stack spacing={0.5}>
                    <Typography variant="subtitle2">Último pagamento{conta.status !== "PAGA" ? " (estornado)" : ""}</Typography>
                    {conta.juros != null && conta.multa != null && conta.desconto != null
                        ? <Typography variant="body2">Juros: {moeda.format(conta.juros)} · Multa: {moeda.format(conta.multa)} · Desconto: {moeda.format(conta.desconto)}</Typography>
                        : <Typography variant="body2">Encargos não discriminados no registro legado.</Typography>}
                    {conta.valorPago !== null && <Typography variant="body2">Total pago: {moeda.format(conta.valorPago)}</Typography>}
                    <Typography variant="caption" color="text.secondary">Movimento #{conta.movimentacaoFinanceiraId}. Encargos preservados no extrato financeiro.</Typography>
                </Stack>}
                <Stack component="fieldset" spacing={2} disabled={somenteLeitura || salvando} sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
                <CampoTexto placeholder="Identifique a operação…" autoFocus required fullWidth label="Descrição" name="descricao" value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })} slotProps={{ htmlInput: { maxLength: 200 } }} />
                <CampoTexto placeholder="Ex.: nota, boleto ou referência…" fullWidth label="Número do documento" name="documento" value={form.documento}
                    onChange={(e) => setForm({ ...form, documento: e.target.value })} slotProps={{ htmlInput: { maxLength: 80 } }} />
                <FornecedorAutocomplete value={fornecedor} placeholder="Sem fornecedor" disabled={somenteLeitura || !!conta?.entradaMercadoriaId}
                    onChange={(item) => { setFornecedor(item); setForm({ ...form, fornecedorId: item?.id ?? "" }); }} />
                <CampoTexto placeholder="Ex.: Serviços, aluguel…" fullWidth label="Categoria" name="categoria" value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })} slotProps={{ htmlInput: { maxLength: 100 } }} />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <CampoTexto fullWidth label="Emissão" name="dataEmissao" type="date" value={form.dataEmissao}
                        onChange={(e) => setForm({ ...form, dataEmissao: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                    <CampoTexto fullWidth required label="Vencimento" name="dataVencimento" type="date" value={form.dataVencimento}
                        onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                </Stack>
                <CampoMonetario canonico placeholder="Ex.: 1.234,56…" fullWidth required label="Valor (R$)" name="valor" value={form.valor}
                    onValueChange={v => setForm({ ...form, valor: v })} />
                <CampoTexto placeholder="Informações adicionais sobre a operação…" fullWidth multiline minRows={3} label="Observação" name="observacao" value={form.observacao}
                    onChange={(e) => setForm({ ...form, observacao: e.target.value })} slotProps={{ htmlInput: { maxLength: 1000 } }} />
                </Stack>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", px: 3, py: 2, borderTop: 1, borderColor: "divider" }}>
                <Button onClick={onFechar} disabled={salvando}>{somenteLeitura ? "Fechar" : "Cancelar"}</Button>
                {!somenteLeitura && <Button type="submit" variant="contained" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>}
            </Stack>
        </Box>
    </Drawer>;
}
