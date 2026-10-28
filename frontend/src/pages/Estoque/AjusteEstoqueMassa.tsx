import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Typography } from "@mui/material";
import CampoTexto from "../../components/ui/CampoTexto";
import { CampoQuantidade } from "../../components/ui/CampoDecimal";
import { numeroDecimal } from "../../utils/numeroFormulario";
import { obterSessao } from "../../utils/auth/sessao";
import { listarProdutosEstoque } from "../../services/estoqueService";
import { confirmarAjusteLote, previaAjusteLote, previaImportacaoEstoque, type PedidoAjusteLote, type ResultadoAjusteLote, type PreviaImportacaoEstoque } from "../../services/ajusteEstoqueLoteService";
import type { Produto } from "../../types/produto";

const formatar = (v: number | null) => v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const decimalPlanilha = (v: string | null) => v == null ? "—" : v.replace(".", ",");
type Selecionado = { produto: Produto; valor: string };

export default function AjusteEstoqueMassa({ onConcluido }: { onConcluido: () => void }) {
    const [aberto, setAberto] = useState(false);
    const [modoImportacao, setModoImportacao] = useState(false);
    const [arquivo, setArquivo] = useState<File | null>(null);
    const [busca, setBusca] = useState("");
    const [pagina, setPagina] = useState(0);
    const [paginaItens, setPaginaItens] = useState(0);
    const [paginaImportacao, setPaginaImportacao] = useState(0);
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [total, setTotal] = useState(0);
    const [carregando, setCarregando] = useState(false);
    const [itens, setItens] = useState<Selecionado[]>([]);
    const [motivo, setMotivo] = useState("");
    const [previa, setPrevia] = useState<ResultadoAjusteLote | null>(null);
    const [importacao, setImportacao] = useState<PreviaImportacaoEstoque | null>(null);
    const [resultado, setResultado] = useState<ResultadoAjusteLote | null>(null);
    const [erro, setErro] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [pendente, setPendente] = useState<PedidoAjusteLote | null>(null);
    const emEnvio = useRef(false);
    const admin = obterSessao()?.perfil === "ADMIN";
    const editavel = !previa && !resultado && !pendente && !enviando;

    useEffect(() => {
        if (!aberto || !editavel || modoImportacao) return;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setCarregando(true);
            listarProdutosEstoque({ busca, page: pagina, size: 10 }, controller.signal)
                .then(r => { if (!controller.signal.aborted) { setProdutos(r.items); setTotal(r.totalItems); } })
                .catch(() => { if (!controller.signal.aborted) { setProdutos([]); setErro("Não foi possível pesquisar produtos."); } })
                .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        }, 250);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [aberto, editavel, modoImportacao, busca, pagina]);

    function abrir(importar: boolean) {
        if (resultado) { setItens([]); setMotivo(""); setArquivo(null); }
        setModoImportacao(importar); setAberto(true); setResultado(null); setPrevia(null); setImportacao(null); setErro("");
    }
    async function solicitarPrevia() {
        if (emEnvio.current) return;
        emEnvio.current = true; setEnviando(true); setErro("");
        try { setPrevia(await previaAjusteLote({ modo: "SALDO_FINAL", motivo: motivo.trim(), itens: itens.map(i => ({ produtoId: i.produto.id, valor: i.valor })) })); }
        catch { setErro("Não foi possível gerar a prévia. Revise os dados e tente novamente."); }
        finally { emEnvio.current = false; setEnviando(false); }
    }
    async function solicitarPreviaImportacao() {
        if (!arquivo || arquivo.size > 2 * 1024 * 1024 || emEnvio.current) return;
        emEnvio.current = true; setEnviando(true); setErro("");
        try {
            const resposta = await previaImportacaoEstoque(arquivo, motivo.trim());
            setImportacao(resposta); setPaginaImportacao(0); setPrevia(resposta.lote);
        } catch (e) {
            const status = axios.isAxiosError(e) ? e.response?.status : undefined;
            setErro(status === 413 ? "O arquivo excede 2 MiB ou 200 linhas. Divida a planilha e tente novamente."
                : "Não foi possível analisar o arquivo. Confira o formato CSV/XLSX e as mensagens de validação.");
        } finally { emEnvio.current = false; setEnviando(false); }
    }
    async function confirmar() {
        if (!previa || emEnvio.current) return;
        const pedido: PedidoAjusteLote = pendente ?? {
            modo: "SALDO_FINAL" as const, motivo: motivo.trim(), chaveRequisicao: crypto.randomUUID(),
            itens: previa.itens.map(l => {
                const linha = importacao?.linhas.find(i => i.produtoId === l.produtoId);
                return { produtoId: l.produtoId, valor: linha?.quantidade ?? itens.find(i => i.produto.id === l.produtoId)!.valor,
                    saldoEsperado: linha?.saldoAtual ?? l.saldoAnterior!, ultimaMovimentacaoIdEsperada: l.ultimaMovimentacaoId };
            }),
        };
        emEnvio.current = true; setPendente(pedido); setEnviando(true); setErro("");
        try { const resposta = await confirmarAjusteLote(pedido); setResultado(resposta); setPendente(null); onConcluido(); }
        catch (e) {
            const status = axios.isAxiosError(e) ? e.response?.status : undefined;
            if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
                setPendente(null);
                if (status === 409) { setPrevia(null); setImportacao(null); }
                setErro(status === 409 ? "O lote ou estoque mudou. Atualize a prévia antes de confirmar. Nenhum ajuste novo foi aplicado por esta tentativa."
                    : "A confirmação foi recusada. Revise os dados ou suas permissões.");
            } else setErro("Não foi possível confirmar o resultado. Tente novamente com a mesma chave; seus dados foram preservados.");
        } finally { emEnvio.current = false; setEnviando(false); }
    }
    if (!admin) return null;
    const valido = itens.length > 0 && motivo.trim().length > 0 && motivo.trim().length <= 255
        && itens.every(i => { const v = numeroDecimal(i.valor, 3); return v !== null && v >= 0; });
    const linhas = resultado?.itens ?? previa?.itens;
    const previsaoValida = importacao ? importacao.totais.invalidos === 0 && importacao.totais.validos > 0 : !previa?.itens.some(l => l.erros.length > 0);
    const paginaItensAtual = Math.min(paginaItens, Math.max(0, Math.ceil(itens.length / 25) - 1));
    function baixarModelo() {
        const url = URL.createObjectURL(new Blob(["\ufeffCódigo;Produto;Quantidade\r\n"], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url; link.download = "modelo-ajuste-estoque.csv"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    return <>
        <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => abrir(false)}>Ajuste em massa</Button>
            <Button variant="outlined" onClick={() => abrir(true)}>Importar planilha</Button>
        </Stack>
        <Dialog open={aberto} fullWidth maxWidth="lg" aria-labelledby="ajuste-massa-titulo" onClose={() => { if (!enviando && !pendente) setAberto(false); }}>
            <DialogTitle id="ajuste-massa-titulo">{modoImportacao ? "Importar estoque por planilha" : "Ajuste em massa · Saldo físico"}</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography variant="body2">Informe o saldo físico final. A confirmação aplica todo o lote ou nenhum ajuste. Limite: 200 produtos.</Typography>
                    {erro && <Alert severity="error" role="alert">{erro}</Alert>}
                    {resultado && <Alert severity="success" role="status">Lote confirmado: {resultado.alterados} ajustes e {resultado.semAlteracao} produtos sem alteração. Sem diferença não gera movimento.</Alert>}
                    {modoImportacao && <>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
                            <Button onClick={baixarModelo}>Baixar modelo CSV</Button>
                            <Button component="label" variant="outlined" disabled={!editavel}>
                                {arquivo ? "Trocar arquivo" : "Selecionar CSV ou XLSX"}
                                <input aria-label="Selecionar arquivo CSV ou XLSX" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden
                                    onChange={e => { setArquivo(e.target.files?.[0] ?? null); setPrevia(null); setImportacao(null); }} />
                            </Button>
                            <Typography variant="body2" aria-live="polite">{arquivo ? `${arquivo.name} · ${arquivo.size < 1024 ? `${arquivo.size} bytes` : `${(arquivo.size / 1024).toFixed(1)} KiB`}` : "CSV UTF-8 com ponto e vírgula ou XLSX · até 2 MiB e 200 linhas"}</Typography>
                        </Stack>
                        {arquivo && arquivo.size > 2 * 1024 * 1024 && <Alert severity="error">O arquivo excede o limite de 2 MiB.</Alert>}
                        {importacao && <>
                            <Alert severity={importacao.totais.invalidos ? "warning" : "info"}>
                                {importacao.totais.linhas} {importacao.totais.linhas === 1 ? "linha" : "linhas"} · {importacao.totais.identificados} {importacao.totais.identificados === 1 ? "identificado" : "identificados"} · {importacao.totais.validos} válidas · {importacao.totais.invalidos} inválidas · {importacao.totais.comDiferenca} com diferença · {importacao.totais.semAlteracao} sem alteração
                            </Alert>
                            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "block", sm: "none" } }}>Deslize a tabela para conferir os saldos, diferenças e situações.</Typography>
                            <TableContainer tabIndex={0} aria-label="Prévia das linhas importadas" sx={{ maxWidth: "100%", overflowX: "auto" }}>
                                <Table size="small" sx={{ minWidth: 760, "& td:nth-of-type(n+3):nth-of-type(-n+5)": { fontVariantNumeric: "tabular-nums" } }}>
                                    <TableHead><TableRow><TableCell>Linha / código</TableCell><TableCell>Produto</TableCell><TableCell align="right">Atual</TableCell><TableCell align="right">Importado</TableCell><TableCell align="right">Diferença</TableCell><TableCell>Situação</TableCell></TableRow></TableHead>
                                    <TableBody>{importacao.linhas.slice(paginaImportacao * 25, (paginaImportacao + 1) * 25).map(l => {
                                        const concluida = resultado?.itens.find(i => i.produtoId === l.produtoId);
                                        return <TableRow key={l.linha}>
                                            <TableCell>{l.linha} · {l.codigo}</TableCell><TableCell>{l.produto ?? "Produto não identificado"}{l.descricaoPlanilha ? ` · planilha: ${l.descricaoPlanilha}` : ""}</TableCell>
                                            <TableCell align="right">{decimalPlanilha(l.saldoAtual)}</TableCell><TableCell align="right">{decimalPlanilha(l.quantidade)}</TableCell>
                                            <TableCell align="right">{decimalPlanilha(l.diferenca)}</TableCell>
                                            <TableCell>{l.erros.length ? l.erros.join(" ") : concluida ? `Aplicado · movimento ${concluida.movimentacaoId ?? "—"}` : l.situacao === "SEM_ALTERACAO" ? "Sem alteração" : "Válido"}</TableCell>
                                        </TableRow>;
                                    })}</TableBody>
                                </Table>
                            </TableContainer>
                            {importacao.linhas.length > 25 && <TablePagination component="div" count={importacao.linhas.length} page={paginaImportacao} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_, p) => setPaginaImportacao(p)} />}
                        </>}
                    </>}
                    {!modoImportacao && editavel && <>
                        <CampoTexto label="Pesquisar produtos para ajuste" value={busca} onChange={e => { setBusca(e.target.value); setPagina(0); }} autoFocus />
                        {carregando && <Typography role="status">Pesquisando…</Typography>}
                        {!carregando && produtos.length === 0 && <Typography>Nenhum produto encontrado.</Typography>}
                        <Stack spacing={0.5}>{produtos.map(p => <Box key={p.id} sx={{ display: "flex", gap: 1, justifyContent: "space-between", alignItems: "center" }}>
                            <Typography variant="body2">{p.codigoInterno} · {p.nome}</Typography>
                            <Button disabled={itens.length >= 200 || itens.some(i => i.produto.id === p.id) || !p.ativo || !p.controlaEstoque || p.composto}
                                aria-label={`Adicionar ${p.nome}`} onClick={() => setItens(atual => [...atual, { produto: p, valor: "" }])}>Adicionar</Button>
                        </Box>)}</Stack>
                        <TablePagination component="div" count={total} page={pagina} rowsPerPage={10} rowsPerPageOptions={[10]} onPageChange={(_, p) => setPagina(p)} />
                    </>}
                    <CampoTexto label="Motivo do ajuste em massa" required multiline value={motivo} slotProps={{ input: { readOnly: !editavel } }}
                        helperText="Obrigatório. Registrado no histórico de cada ajuste (até 255 caracteres)." onChange={e => setMotivo(e.target.value)} />
                    {!modoImportacao && <>
                        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "block", sm: "none" } }}>Deslize a tabela para conferir saldo informado e diferença.</Typography>
                        <TableContainer tabIndex={0} aria-label="Produtos e diferenças do ajuste" sx={{ maxWidth: "100%", overflowX: "auto" }}>
                            <Table size="small" sx={{ minWidth: 600 }}>
                                <TableHead><TableRow><TableCell>Produto</TableCell><TableCell align="right">Saldo atual</TableCell><TableCell align="right">Saldo informado</TableCell><TableCell align="right">Diferença</TableCell><TableCell>Validação / Resultado</TableCell></TableRow></TableHead>
                                <TableBody>{itens.slice(paginaItensAtual * 25, (paginaItensAtual + 1) * 25).map(i => {
                                    const l = linhas?.find(x => x.produtoId === i.produto.id);
                                    return <TableRow key={i.produto.id}>
                                        <TableCell>{i.produto.codigoInterno} · {i.produto.nome}</TableCell>
                                        <TableCell align="right">{formatar(l?.saldoAnterior ?? i.produto.estoqueAtual)}</TableCell>
                                        <TableCell align="right" sx={{ minWidth: 160 }}>{editavel ? <CampoQuantidade canonico label={`Saldo físico ${i.produto.nome}`} value={i.valor}
                                            onValueChange={valor => setItens(atual => atual.map(x => x.produto.id === i.produto.id ? { ...x, valor } : x))} /> : formatar(l?.saldoFinal ?? null)}</TableCell>
                                        <TableCell align="right">{l?.diferenca != null ? `${l.diferenca > 0 ? "+" : ""}${formatar(l.diferenca)}` : "Solicite a prévia"}</TableCell>
                                        <TableCell>{l ? l.erros.length ? <Typography color="error">{l.erros.join(" ")}</Typography> : l.status === "SEM_ALTERACAO" ? "Sem alteração" : resultado ? `Movimento ${l.movimentacaoId}` : "Elegível"
                                            : <Button aria-label={`Remover ${i.produto.nome}`} onClick={() => setItens(atual => atual.filter(x => x.produto.id !== i.produto.id))}>Remover</Button>}</TableCell>
                                    </TableRow>;
                                })}</TableBody>
                            </Table>
                        </TableContainer>
                        {itens.length > 25 && <TablePagination component="div" count={itens.length} page={paginaItensAtual} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_, p) => setPaginaItens(p)} />}
                    </>}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
                <Button disabled={enviando || !!pendente} onClick={() => setAberto(false)}>{resultado ? "Fechar resultado" : "Cancelar"}</Button>
                {previa && !resultado && <Button disabled={enviando || !!pendente} onClick={() => { setPrevia(null); setImportacao(null); setErro(""); }}>Revisar dados</Button>}
                {!resultado && (!previa ? <Button variant="contained" disabled={(modoImportacao ? !arquivo || arquivo.size > 2 * 1024 * 1024 : !valido) || !motivo.trim() || enviando}
                    onClick={() => void (modoImportacao ? solicitarPreviaImportacao() : solicitarPrevia())}>{enviando ? (modoImportacao ? "Lendo planilha…" : "Gerando prévia…") : (modoImportacao ? "Analisar arquivo" : "Gerar prévia")}</Button>
                    : <Button variant="contained" disabled={enviando || !previsaoValida} onClick={() => void confirmar()}>{enviando ? "Confirmando…" : pendente ? "Tentar novamente com a mesma chave" : "Confirmar ajustes"}</Button>)}
            </DialogActions>
        </Dialog>
    </>;
}
