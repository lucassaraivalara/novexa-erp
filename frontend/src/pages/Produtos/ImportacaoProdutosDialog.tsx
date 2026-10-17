import { useRef, useState } from "react";
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import AppTable, { type Coluna } from "../../components/ui/AppTable";
import type { ImportacaoProduto, LinhaImportacaoProduto } from "../../types/importacaoProduto";
import { prepararImportacaoProdutos, confirmarImportacaoProdutos, cancelarImportacaoProdutos, baixarErrosImportacaoProdutos } from "../../services/importacaoProdutoService";
import { obterMensagemDaApi } from "../../services/produtoService";

const situacoes = { VALIDA: "Válida", INVALIDA: "Inválida", DUPLICADA: "Duplicada", IGNORADA: "Ignorada" };
export default function ImportacaoProdutosDialog({ onFechar, onImportada }: { onFechar: () => void; onImportada: () => void }) {
    const [arquivo, setArquivo] = useState<File | null>(null);
    const [previa, setPrevia] = useState<ImportacaoProduto | null>(null);
    const [erro, setErro] = useState("");
    const [ocupado, setOcupado] = useState(false);
    const [pagina, setPagina] = useState(0);
    const [tamanho, setTamanho] = useState(10);
    const executando = useRef(false);
    async function executar(acao: () => Promise<void>) {
        if (executando.current) return;
        executando.current = true; setOcupado(true); setErro("");
        try { await acao(); }
        catch (e) { setErro(obterMensagemDaApi(e, "Não foi possível concluir a importação. Tente novamente; repetir a confirmação não duplica o lote.")); }
        finally { executando.current = false; setOcupado(false); }
    }
    function selecionar(valor: File | null) {
        setErro(""); setArquivo(null);
        if (!valor) return;
        if (!/\.(xls|xlsx|csv)$/i.test(valor.name)) { setErro("Use um arquivo XLS, XLSX ou CSV."); return; }
        if (valor.size > 2 * 1024 * 1024) { setErro("O arquivo deve ter no máximo 2 MB."); return; }
        setArquivo(valor);
    }
    async function fechar() {
        if (executando.current) return;
        if (previa?.estado === "PREVIA") await executar(async () => { await cancelarImportacaoProdutos(previa.id); onFechar(); });
        else onFechar();
    }
    const colunas: Coluna<LinhaImportacaoProduto>[] = [
        { campo: "linha", cabecalho: "Linha", largura: 65 },
        { campo: "nome", cabecalho: "Produto", render: (_, l) => <Stack spacing={0.25}><strong>{l.campos.nome || "—"}</strong><Typography variant="caption">Código: {l.campos.codigoInterno || "—"}<br />EAN / GTIN: {l.campos.codigoBarras || "—"}</Typography></Stack> },
        { campo: "preco", cabecalho: "Preço e unidade", render: (_, l) => <Typography variant="body2">Preço: {l.campos.precoVenda || "—"}<br />Unidade: {l.campos.unidadeMedida || "—"}<br />Estoque mín.: {l.campos.estoqueMinimo || "0"}<br />Status: {l.campos.ativo || "Ativo"}</Typography> },
        { campo: "classificacao", cabecalho: "Classificação", render: (_, l) => <Typography variant="body2">Categoria: {l.campos.categoria || "—"}<br />Subcategoria: {l.campos.subcategoria || "—"}<br />Marca: {l.campos.marca || "—"}</Typography> },
        { campo: "fornecedor", cabecalho: "Fornecedor e identificação", render: (_, l) => <Typography variant="body2">Fornecedor: {l.campos.fornecedor || "—"}<br />NCM: {l.campos.ncm || "—"}<br />CEST: {l.campos.cest || "—"}</Typography> },
        { campo: "situacao", cabecalho: "Resultado", render: (_, l) => <Stack spacing={0.5}><Chip size="small" label={situacoes[l.situacao]} color={l.situacao === "VALIDA" ? "success" : l.situacao === "INVALIDA" ? "error" : "default"} variant="outlined" /><Typography variant="caption" sx={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>{l.mensagem}</Typography></Stack> },
    ];
    return <Dialog open fullWidth maxWidth="lg" onClose={() => void fechar()} aria-labelledby="importacao-produtos-titulo"
        slotProps={{ paper: { sx: { m: { xs: 1, sm: 3 }, width: { xs: "calc(100% - 16px)", sm: "100%" }, maxHeight: "calc(100% - 16px)" } } }}>
        <DialogTitle id="importacao-produtos-titulo">Importar Produtos</DialogTitle>
        <DialogContent dividers>
            <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">Envie XLS, XLSX ou CSV com até 2 MB, uma aba e 2.000 linhas. Revise os dados antes de confirmar.</Typography>
                <Alert severity="info">Somente novos produtos. Código ou EAN já existente rejeita a linha; nenhum produto será atualizado. Estoque Atual e demais campos fora do modelo serão ignorados. Não há movimentação de estoque.</Alert>
                {erro && <Alert severity="error">{erro}</Alert>}
                {!previa && <>
                    <Typography variant="body2">Colunas: Nome, Código, EAN / GTIN, Preço, Unidade, Estoque Min., Status, Categoria, Sub Categoria, Marca, Fornecedor Principal, NCM e CEST. Nome, Preço e Unidade são obrigatórios. Vínculos devem existir nesta empresa; nomes ambíguos serão rejeitados.</Typography>
                    <input type="file" accept=".xls,.xlsx,.csv" aria-label="Arquivo de produtos" disabled={ocupado} onChange={e => selecionar(e.target.files?.[0] ?? null)} style={{ maxWidth: "100%" }} />
                    {arquivo && <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{arquivo.name}</Typography>}
                </>}
                {previa && <>
                    <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{previa.arquivo}</Typography>
                    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                        <Chip label={`Válidas: ${previa.validas}`} color="success" variant="outlined" />
                        <Chip label={`Inválidas: ${previa.invalidas}`} color="error" variant="outlined" />
                        <Chip label={`Duplicadas: ${previa.duplicadas}`} variant="outlined" />
                        <Chip label={`Ignoradas: ${previa.ignoradas}`} variant="outlined" />
                    </Stack>
                    {previa.colunasIgnoradas.length > 0 && <Alert severity="info">Colunas ignoradas: {previa.colunasIgnoradas.join(", ")}.</Alert>}
                    {previa.estado === "CONFIRMADA" ? <Alert severity="success">Importação confirmada: {previa.importados} {previa.importados === 1 ? "produto" : "produtos"}. Reenvios deste arquivo não duplicam os produtos.</Alert>
                        : <Alert severity="warning">Ao confirmar, serão gravadas somente as linhas válidas ({previa.validas}). As demais serão descartadas. Cancelar não grava produtos.</Alert>}
                    <AppTable colunas={colunas} linhas={previa.linhas.slice(pagina * tamanho, (pagina + 1) * tamanho)} obterChaveLinha={l => l.linha}
                        minWidth={1000} compacta paginacao={{ pagina, linhasPorPagina: tamanho, total: previa.linhas.length,
                            onPageChange: setPagina, onRowsPerPageChange: valor => { setTamanho(valor); setPagina(0); } }} />
                </>}
            </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, flexWrap: "wrap", gap: 1 }}>
            <Button disabled={ocupado} onClick={() => void fechar()}>{previa?.estado === "CONFIRMADA" ? "Voltar aos produtos" : "Cancelar"}</Button>
            {previa && (previa.invalidas + previa.duplicadas + previa.ignoradas > 0) && <Button disabled={ocupado}
                onClick={() => void executar(async () => { await baixarErrosImportacaoProdutos(previa.id); })}>Baixar relatório de erros</Button>}
            {!previa && <Button variant="contained" startIcon={<UploadFileOutlinedIcon />} disabled={!arquivo || ocupado}
                onClick={() => void executar(async () => { setPrevia(await prepararImportacaoProdutos(arquivo!)); setPagina(0); })}>{ocupado ? "Preparando…" : "Gerar prévia"}</Button>}
            {previa?.estado === "PREVIA" && <Button variant="contained" disabled={ocupado || previa.validas === 0}
                onClick={() => void executar(async () => { const resultado = await confirmarImportacaoProdutos(previa.id); setPrevia(resultado); onImportada(); })}>
                {ocupado ? "Aguarde…" : `Confirmar ${previa.validas} ${previa.validas === 1 ? "produto" : "produtos"}`}</Button>}
        </DialogActions>
    </Dialog>;
}
