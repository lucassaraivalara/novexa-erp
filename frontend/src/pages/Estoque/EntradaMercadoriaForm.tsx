import { useRef, useState, type FormEvent } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CadastroDialog from "../../components/ui/CadastroDialog";
import StatusChip from "../../components/ui/StatusChip";
import FornecedorAutocomplete, { type FornecedorOpcao } from "../../components/fornecedores/FornecedorAutocomplete";
import FornecedorForm from "../../components/fornecedores/FornecedorForm";
import { atualizarEntrada, buscarEntradaPorId, confirmarEntrada, criarEntrada, criarEntradaXml } from "../../services/entradaMercadoriaService";
import { obterMensagemDaApi } from "../../services/produtoService";
import type { EntradaMercadoria, EntradaMercadoriaInput, EntradaXmlPreview } from "../../types/entradaMercadoria";
import EntradaMercadoriaItens from "./EntradaMercadoriaItens";
import { novoItemEntrada, numeroEntrada, totalPreviewEntrada, validarItensEntrada, type ItemFormularioEntrada } from "./entradaMercadoriaRegras";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function EntradaMercadoriaForm({ entrada, previewXml, onFechar, onConcluido, onAtualizar }: {
    entrada: EntradaMercadoria | null; onFechar: () => void;
    previewXml?: EntradaXmlPreview;
    onConcluido: (entrada: EntradaMercadoria) => void; onAtualizar: () => void;
}) {
    const [persistida, setPersistida] = useState(entrada);
    const [fornecedor, setFornecedor] = useState<FornecedorOpcao | null>(() => entrada ? { id: entrada.fornecedorId, razaoSocial: entrada.fornecedorNome }
        : previewXml?.fornecedorMatch?.ativo ? previewXml.fornecedorMatch : null);
    const [numeroNota, setNumeroNota] = useState(entrada?.numeroNota ?? previewXml?.numeroNota ?? "");
    const [serie, setSerie] = useState(entrada?.serie ?? previewXml?.serie ?? "");
    const [dataEmissao, setDataEmissao] = useState(entrada?.dataEmissao ?? previewXml?.dataEmissao ?? "");
    const [observacao, setObservacao] = useState(entrada?.observacao ?? "");
    const [itens, setItens] = useState<ItemFormularioEntrada[]>(() => entrada?.itens?.map(i => ({
        chave: String(i.id), produto: { id: i.produtoId, nome: i.produtoNome }, quantidade: String(i.quantidade), custo: String(i.valorUnitario),
        historico: { produtoId: i.produtoId, quantidade: i.quantidade, valorUnitario: i.valorUnitario,
            descricaoOriginal: i.descricaoOriginal, codigoProdutoFornecedor: i.codigoProdutoFornecedor,
            gtin: i.gtin, ncm: i.ncm, cfop: i.cfop, unidade: i.unidade },
    })) ?? previewXml?.itens.map((i, indice) => {
        return { chave: String(indice), produto: i.produtoMatch, quantidade: String(i.quantidade), custo: String(i.valorUnitario),
            historico: { produtoId: i.produtoMatch?.id ?? 0, quantidade: i.quantidade, valorUnitario: i.valorUnitario,
                descricaoOriginal: i.descricaoOriginal, codigoProdutoFornecedor: i.codigoProdutoFornecedor,
                gtin: i.gtin, ncm: i.ncm, cfop: i.cfop, unidade: i.unidade } };
    }) ?? [novoItemEntrada()]);
    const [novoFornecedor, setNovoFornecedor] = useState(false);
    const [revisando, setRevisando] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const ocupado = useRef(false);
    const chave = useRef<string | null>(null);
    const somenteLeitura = persistida !== null && persistida.status !== "RASCUNHO";
    const total = somenteLeitura ? persistida.valorTotal : totalPreviewEntrada(itens);
    const pendentes = itens.reduce((n, i) => n + (i.produto ? 0 : 1), 0);
    const resolucaoPendente = Boolean(previewXml && (!fornecedor || pendentes || !itens.length));

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
            chaveAcessoNfe: persistida?.chaveAcessoNfe ?? previewXml?.chaveAcessoNfe,
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
            atual = atual ? await atualizarEntrada(atual.id, dados()) : previewXml
                ? await criarEntradaXml({ ...dados(), chaveAcessoNfe: previewXml.chaveAcessoNfe }) : await criarEntrada(dados());
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
        {previewXml && <Stack spacing={1} sx={{ overflowWrap: "anywhere" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Dados da NF-e</Typography>
            <Typography variant="body2">Emitente: {previewXml.fornecedorXml.razaoSocial}</Typography>
            <Typography variant="body2" color="text.secondary">CPF/CNPJ: {previewXml.fornecedorXml.cpfCnpj} · Nome fantasia: {previewXml.fornecedorXml.nomeFantasia || "Não informado"}</Typography>
            <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>Chave: {previewXml.chaveAcessoNfe}</Typography>
            <Typography variant="body2">Valor dos produtos (NF-e): {moeda.format(previewXml.valorProdutos)} · Valor total (NF-e): {moeda.format(previewXml.valorTotal)}</Typography>
            {previewXml.fornecedorMatch?.ativo === false && !fornecedor && <Alert severity="warning">Fornecedor encontrado, mas está inativo. Selecione outro fornecedor ativo.</Alert>}
            {fornecedor && <Box><StatusChip status="ATIVO" label={fornecedor.id === previewXml.fornecedorMatch?.id ? "Fornecedor encontrado" : "Fornecedor selecionado"} /></Box>}
            <Typography variant="body2" color="text.secondary">Revise quantidades e custos. Quantidade: até 3 casas decimais. Custo unitário: até 2 casas decimais.</Typography>
        </Stack>}
        {somenteLeitura ? <TextField label="Fornecedor" value={fornecedor?.razaoSocial ?? ""} slotProps={{ input: { readOnly: true } }} /> :
            <Box sx={{ display: "grid", gridTemplateColumns: previewXml ? { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) auto" } : "minmax(0, 1fr) auto", gap: 1, alignItems: "start" }}>
                <FornecedorAutocomplete value={fornecedor} onChange={setFornecedor} label="Fornecedor *" disabled={salvando} />
                {(!previewXml || !previewXml.fornecedorMatch) && <Button type="button" sx={{ justifySelf: "start" }} disabled={salvando} startIcon={<AddRoundedIcon />} onClick={() => setNovoFornecedor(true)}>{previewXml ? "Cadastrar fornecedor" : "Novo"}</Button>}
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
        {previewXml && resolucaoPendente && <Alert severity="warning">{!fornecedor && "Selecione um fornecedor ativo. "}
            {pendentes > 0 && `${pendentes} ${pendentes === 1 ? "produto precisa ser vinculado." : "produtos precisam ser vinculados."}`}
            {!itens.length && "Informe pelo menos um item."}</Alert>}
        <TextField label="Observação" value={observacao} disabled={salvando} multiline minRows={2} onChange={e => setObservacao(e.target.value)}
            slotProps={{ input: { readOnly: somenteLeitura }, htmlInput: { maxLength: 2000 } }} />
        <Stack direction="row" sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1, pt: 1, borderTop: 1, borderColor: "divider" }}>
            <Typography>{itens.length} {itens.length === 1 ? "item" : "itens"}</Typography>
            <Typography sx={{ fontWeight: 600 }}>{somenteLeitura ? "Valor total" : previewXml ? "Total da entrada (itens revisados)" : "Total previsto"}: {moeda.format(total)}</Typography>
        </Stack>
    </Stack>;

    if (somenteLeitura) return <Dialog open onClose={onFechar} fullWidth maxWidth="md" aria-labelledby="entrada-detalhe-titulo">
        <DialogTitle id="entrada-detalhe-titulo">Entrada de mercadoria #{persistida.id}</DialogTitle>
        <DialogContent dividers>{conteudo}</DialogContent><DialogActions><Button onClick={onFechar}>Fechar</Button></DialogActions>
    </Dialog>;
    return <>
        <CadastroDialog aberto variante="full" titulo={persistida ? `Editar entrada #${persistida.id}` : previewXml ? "Revisar NF-e" : "Entrada manual"}
            salvando={salvando} onFechar={onFechar} onSubmit={revisar} textoSalvar="Confirmar entrada" textoCancelar="Voltar"
            desabilitarSalvar={resolucaoPendente}
            acoesSecundarias={<Button type="button" disabled={salvando || resolucaoPendente} onClick={() => void salvar(false)}>{previewXml ? "Salvar como rascunho" : "Salvar rascunho"}</Button>}>
            {conteudo}
        </CadastroDialog>
        {novoFornecedor && <FornecedorForm modo="rapido" onFechar={() => setNovoFornecedor(false)}
            dadosIniciais={previewXml?.fornecedorXml}
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
