import { useRef, useState, type FormEvent } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CadastroDialog from "../../components/ui/CadastroDialog";
import StatusChip from "../../components/ui/StatusChip";
import FornecedorAutocomplete, { type FornecedorOpcao } from "../../components/fornecedores/FornecedorAutocomplete";
import FornecedorForm from "../../components/fornecedores/FornecedorForm";
import { atualizarEntrada, buscarEntradaPorId, confirmarEntrada, criarEntrada } from "../../services/entradaMercadoriaService";
import { obterMensagemDaApi } from "../../services/produtoService";
import type { EntradaMercadoria, EntradaMercadoriaInput } from "../../types/entradaMercadoria";
import EntradaMercadoriaItens from "./EntradaMercadoriaItens";
import { novoItemEntrada, numeroEntrada, totalPreviewEntrada, validarItensEntrada, type ItemFormularioEntrada } from "./entradaMercadoriaRegras";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function EntradaMercadoriaForm({ entrada, onFechar, onConcluido, onAtualizar }: {
    entrada: EntradaMercadoria | null; onFechar: () => void;
    onConcluido: (entrada: EntradaMercadoria) => void; onAtualizar: () => void;
}) {
    const [persistida, setPersistida] = useState(entrada);
    const [fornecedor, setFornecedor] = useState<FornecedorOpcao | null>(() => entrada ? { id: entrada.fornecedorId, razaoSocial: entrada.fornecedorNome } : null);
    const [numeroNota, setNumeroNota] = useState(entrada?.numeroNota ?? "");
    const [serie, setSerie] = useState(entrada?.serie ?? "");
    const [dataEmissao, setDataEmissao] = useState(entrada?.dataEmissao ?? "");
    const [observacao, setObservacao] = useState(entrada?.observacao ?? "");
    const [itens, setItens] = useState<ItemFormularioEntrada[]>(() => entrada?.itens?.map(i => ({
        chave: String(i.id), produto: { id: i.produtoId, nome: i.produtoNome }, quantidade: String(i.quantidade), custo: String(i.valorUnitario),
        historico: { produtoId: i.produtoId, quantidade: i.quantidade, valorUnitario: i.valorUnitario,
            descricaoOriginal: i.descricaoOriginal, codigoProdutoFornecedor: i.codigoProdutoFornecedor,
            gtin: i.gtin, ncm: i.ncm, cfop: i.cfop, unidade: i.unidade },
    })) ?? [novoItemEntrada()]);
    const [novoFornecedor, setNovoFornecedor] = useState(false);
    const [revisando, setRevisando] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const ocupado = useRef(false);
    const chave = useRef<string | null>(null);
    const somenteLeitura = persistida !== null && persistida.status !== "RASCUNHO";
    const total = somenteLeitura ? persistida.valorTotal : totalPreviewEntrada(itens);

    function validar() {
        const mensagem = !fornecedor ? "Selecione um fornecedor." : validarItensEntrada(itens);
        setErro(mensagem ?? ""); return !mensagem;
    }
    function revisar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault(); if (!ocupado.current && validar()) setRevisando(true);
    }
    function dados(): EntradaMercadoriaInput {
        if (!chave.current) chave.current = crypto.randomUUID();
        return {
            fornecedorId: fornecedor!.id, numeroNota: numeroNota.trim() || null, serie: serie.trim() || null,
            dataEmissao: dataEmissao || null, dataEntrada: persistida?.dataEntrada,
            observacao: observacao.trim() || null, chaveRequisicao: chave.current,
            chaveAcessoNfe: persistida?.chaveAcessoNfe,
            itens: itens.map(i => ({ ...i.historico, produtoId: i.produto!.id, quantidade: numeroEntrada(i.quantidade), valorUnitario: numeroEntrada(i.custo) })),
        };
    }
    async function salvar(confirmar: boolean) {
        if (ocupado.current || !validar()) return;
        ocupado.current = true; setSalvando(true); setErro("");
        let atual = persistida;
        try {
            // Reconciliar uma confirmacao cuja resposta possa ter sido perdida antes de editar o rascunho.
            if (atual) atual = await buscarEntradaPorId(atual.id);
            if (atual && atual.status !== "RASCUNHO") { setPersistida(atual); onAtualizar(); onConcluido(atual); return; }
            atual = atual ? await atualizarEntrada(atual.id, dados()) : await criarEntrada(dados());
            setPersistida(atual); onAtualizar();
            if (confirmar) { atual = await confirmarEntrada(atual.id); setPersistida(atual); }
            onConcluido(atual);
        } catch (e) {
            if (atual) {
                try {
                    const canonica = await buscarEntradaPorId(atual.id); setPersistida(canonica); onAtualizar();
                    if (canonica.status !== "RASCUNHO") { onConcluido(canonica); return; }
                } catch { /* Mantem o ID conhecido para repetir sem criar outra entrada. */ }
            }
            setErro((atual && confirmar ? "Rascunho preservado. " : "") + obterMensagemDaApi(e, "Não foi possível salvar a entrada."));
        } finally { ocupado.current = false; setSalvando(false); setRevisando(false); }
    }

    const conteudo = <Stack spacing={2.5}>
        {erro && <Alert severity="error">{erro}</Alert>}
        {persistida && <Box><StatusChip status={persistida.status} /></Box>}
        {somenteLeitura ? <TextField label="Fornecedor" value={fornecedor?.razaoSocial ?? ""} slotProps={{ input: { readOnly: true } }} /> :
            <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 1, alignItems: "start" }}>
                <FornecedorAutocomplete value={fornecedor} onChange={setFornecedor} label="Fornecedor *" disabled={salvando} />
                <Button type="button" disabled={salvando} startIcon={<AddRoundedIcon />} onClick={() => setNovoFornecedor(true)}>Novo</Button>
            </Box>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 100px 1fr" }, gap: 2 }}>
            <TextField label="Número da nota" value={numeroNota} disabled={salvando} onChange={e => setNumeroNota(e.target.value)}
                slotProps={{ input: { readOnly: somenteLeitura }, htmlInput: { maxLength: 60 } }} />
            <TextField label="Série" value={serie} disabled={salvando} onChange={e => setSerie(e.target.value)}
                slotProps={{ input: { readOnly: somenteLeitura }, htmlInput: { maxLength: 20 } }} />
            <TextField label="Data de emissão" type="date" value={dataEmissao} disabled={salvando} onChange={e => setDataEmissao(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, input: { readOnly: somenteLeitura } }} />
        </Box>
        <EntradaMercadoriaItens itens={itens} onChange={setItens} disabled={salvando || somenteLeitura} somenteLeitura={somenteLeitura} />
        <TextField label="Observação" value={observacao} disabled={salvando} multiline minRows={2} onChange={e => setObservacao(e.target.value)}
            slotProps={{ input: { readOnly: somenteLeitura }, htmlInput: { maxLength: 2000 } }} />
        <Stack direction="row" sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1, pt: 1, borderTop: 1, borderColor: "divider" }}>
            <Typography>{itens.length} {itens.length === 1 ? "item" : "itens"}</Typography>
            <Typography sx={{ fontWeight: 600 }}>{somenteLeitura ? "Valor total" : "Total previsto"}: {moeda.format(total)}</Typography>
        </Stack>
    </Stack>;

    if (somenteLeitura) return <Dialog open onClose={onFechar} fullWidth maxWidth="md" aria-labelledby="entrada-detalhe-titulo">
        <DialogTitle id="entrada-detalhe-titulo">Entrada de mercadoria #{persistida.id}</DialogTitle>
        <DialogContent dividers>{conteudo}</DialogContent><DialogActions><Button onClick={onFechar}>Fechar</Button></DialogActions>
    </Dialog>;
    return <>
        <CadastroDialog aberto variante="full" titulo={persistida ? `Editar entrada #${persistida.id}` : "Entrada manual"}
            salvando={salvando} onFechar={onFechar} onSubmit={revisar} textoSalvar="Confirmar entrada" textoCancelar="Voltar"
            acoesSecundarias={<Button type="button" disabled={salvando} onClick={() => void salvar(false)}>Salvar rascunho</Button>}>
            {conteudo}
        </CadastroDialog>
        {novoFornecedor && <FornecedorForm modo="rapido" onFechar={() => setNovoFornecedor(false)}
            onSalvo={f => { setFornecedor(f); setNovoFornecedor(false); setErro(""); }} />}
        <Dialog open={revisando} onClose={salvando ? undefined : () => setRevisando(false)} fullWidth maxWidth="xs" aria-labelledby="entrada-confirmacao-titulo">
            <DialogTitle id="entrada-confirmacao-titulo">Confirmar entrada?</DialogTitle>
            <DialogContent><Stack spacing={1}>
                <Typography>Fornecedor: {fornecedor?.razaoSocial}</Typography><Typography>Nota: {numeroNota || "Não informada"}</Typography>
                <Typography>Itens: {itens.length}</Typography><Typography>Valor: {moeda.format(total)}</Typography>
                <Typography variant="body2" color="text.secondary">Esta ação adicionará os produtos ao estoque.</Typography>
            </Stack></DialogContent>
            <DialogActions><Button disabled={salvando} onClick={() => setRevisando(false)}>Voltar</Button>
                <Button disabled={salvando} variant="contained" onClick={() => void salvar(true)}>Confirmar entrada</Button></DialogActions>
        </Dialog>
    </>;
}
