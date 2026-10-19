import { useEffect, useState, type FormEvent } from "react";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import AppTable from "../../components/ui/AppTable";
import { resumoCofre, pendenciasCofre, historicoCofre, confirmarCofre, destinarCofre, devolverTroco, extratoCofre,
    type ResumoCofre, type PendenteCofre, type RegistroCofre } from "../../services/cofreService";
import type { MovimentacaoFinanceira } from "../../types/contaFinanceira";
import type { PaginaResponse } from "../../types/paginacao";
import { listarSessoesAbertas, mensagemCaixa } from "../../services/caixaService";
import type { SessaoCaixaAberta } from "../../types/caixa";
import { obterSessao } from "../../utils/auth/sessao";
import { podeExecutarAcaoGerencial } from "../../utils/auth/perfis";
import EntregaCofreCampos from "./EntregaCofreCampos";
import { lerEntregaCofre, novaEntregaCofre } from "./cofreFormulario";

const moeda = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (s: string | null) => s ? new Date(s).toLocaleString("pt-BR") : "—";
const vazio = <T,>(): PaginaResponse<T> => ({ items: [], page: 0, size: 20, totalItems: 0, totalPages: 0 });

export default function CofrePainel({ versao, onAlterado }: { versao: number; onAlterado: () => void }) {
    const gerencial = podeExecutarAcaoGerencial(obterSessao()?.perfil);
    const [resumo, setResumo] = useState<ResumoCofre | null>(null);
    const [pendentes, setPendentes] = useState(vazio<PendenteCofre>);
    const [registros, setRegistros] = useState(vazio<RegistroCofre>);
    const [movimentos, setMovimentos] = useState(vazio<MovimentacaoFinanceira>);
    const [aba, setAba] = useState(0);
    const [pagina, setPagina] = useState(0);
    const [conta, setConta] = useState("");
    const [erro, setErro] = useState("");
    const [consultaConcluida, setConsultaConcluida] = useState("");
    const [atualizacao, setAtualizacao] = useState(0);
    const [modal, setModal] = useState<PendenteCofre | "devolver" | null>(null);
    const [confirmacao, setConfirmacao] = useState<RegistroCofre | PendenteCofre | null>(null);
    const [form, setForm] = useState(novaEntregaCofre);
    const [sessoes, setSessoes] = useState<SessaoCaixaAberta[]>([]);
    const [sessaoId, setSessaoId] = useState("");
    const [chave, setChave] = useState("");
    const [processando, setProcessando] = useState(false);
    const [erroModal, setErroModal] = useState("");
    const chaveConsulta = `${versao}:${atualizacao}:${aba}:${pagina}:${conta}`;
    const carregando = consultaConcluida !== chaveConsulta;
    useEffect(() => {
        const c = new AbortController();
        Promise.all([resumoCofre(c.signal), pendenciasCofre(aba === 0 ? pagina : 0, c.signal), historicoCofre(aba === 1 ? pagina : 0, c.signal),
            aba === 2 && conta ? extratoCofre(Number(conta), pagina, c.signal) : Promise.resolve(null)])
            .then(([r, p, h, m]) => { if (!c.signal.aborted) { setResumo(r); setPendentes(p); setRegistros(h); if (m) setMovimentos(m); setErro(""); } })
            .catch(e => { if (!c.signal.aborted) setErro(mensagemCaixa(e, "Não foi possível consultar o cofre.")); })
            .finally(() => { if (!c.signal.aborted) setConsultaConcluida(chaveConsulta); });
        return () => c.abort();
    }, [versao, atualizacao, aba, pagina, conta, chaveConsulta]);
    function atualizar() { setAtualizacao(n => n + 1); onAlterado(); }
    async function abrirDevolucao() {
        setErro("");
        try {
            setSessoes(await listarSessoesAbertas()); setSessaoId(""); setForm(novaEntregaCofre());
            setChave(crypto.randomUUID()); setErroModal(""); setModal("devolver");
        } catch (e) { setErro(mensagemCaixa(e, "Não foi possível consultar as sessões abertas.")); }
    }
    async function salvar(e: FormEvent) {
        e.preventDefault(); if (processando || !modal) return;
        setProcessando(true); setErroModal("");
        try {
            if (modal === "devolver") {
                if (!sessaoId || !form.confirmar) throw new Error("Selecione a sessão e confirme a entrega do dinheiro para troco.");
                await devolverTroco(chave, Number(sessaoId), { ...lerEntregaCofre({ ...form, troco: "0" }), valorTroco: 0 });
            } else await destinarCofre(modal.sessaoId, lerEntregaCofre(form));
            setModal(null); atualizar();
        } catch (e) { setErroModal(e instanceof Error && !("isAxiosError" in e) ? e.message : mensagemCaixa(e, "Não foi possível registrar a entrega.")); }
        finally { setProcessando(false); }
    }
    async function confirmar() {
        if (!confirmacao || processando) return;
        const id = "recolhimentoId" in confirmacao ? confirmacao.recolhimentoId : confirmacao.id;
        if (!id) return;
        setProcessando(true); setErroModal("");
        try { await confirmarCofre(id); setConfirmacao(null); atualizar(); }
        catch (e) { setErroModal(mensagemCaixa(e, "Não foi possível confirmar a entrega.")); }
        finally { setProcessando(false); }
    }
    const paginaAtual = aba === 0 ? pendentes : aba === 1 ? registros : movimentos;
    const paginacao = { pagina, linhasPorPagina: 20, total: paginaAtual.totalItems, onPageChange: setPagina, onRowsPerPageChange: () => {}, opcoesLinhasPorPagina: [20] };
    return <Paper component="section" aria-label="Dinheiro em cofre" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: 2, minWidth: 0 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", mb: 2 }}>
            <Box><Typography component="h2" variant="h6">Dinheiro em cofre</Typography>
                <Typography variant="body2" color="text.secondary">Entregas confirmadas das sessões. Fechar Caixa ou registrar sangria sem destino não credita o cofre.</Typography></Box>
            {gerencial && <Button startIcon={<SavingsOutlinedIcon />} variant="outlined" onClick={() => void abrirDevolucao()}>Devolver para troco</Button>}
        </Stack>
        {erro && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={atualizar}>Tentar novamente</Button>}>{erro}</Alert>}
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 3, mb: 1 }}>
            {[["Saldo em cofre", resumo?.saldo], ["Entradas confirmadas", resumo?.entradas], ["Saídas registradas", resumo?.saidas]].map(([label, valor]) => <Box key={label}>
                <Typography variant="caption" color="text.secondary">{label}</Typography><Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{typeof valor === "number" ? moeda(valor) : "—"}</Typography>
            </Box>)}
        </Stack>
        <Typography variant="caption" color="text.secondary">Saldo da Conta Financeira COFRE, separado do banco e da sessão operacional. Entradas e saídas somam movimentos não estornados; históricos legados podem conter saldo inicial sem movimento.</Typography>
        <Tabs value={aba} onChange={(_, v) => { setAba(v); setPagina(0); }} variant="scrollable" scrollButtons="auto" aria-label="Consultas do cofre" sx={{ mt: 1 }}>
            <Tab label={`Pendências de sessões (${pendentes.totalItems})`} /><Tab label="Recolhimentos e troco" /><Tab label="Entradas, saídas e depósitos" />
        </Tabs>
        {aba === 0 && <Alert severity="info" sx={{ mt: 1 }}>Sessões antigas também podem aparecer sem destino registrado. Confira antes de confirmar: dinheiro já lançado manualmente no cofre não deve ser recolhido novamente.</Alert>}
        {aba === 0 && <AppTable linhas={pendentes.items} obterChaveLinha={r => r.sessaoId} carregando={carregando} minWidth={760} paginacao={paginacao}
            colunas={[{ campo: "sessaoId", cabecalho: "Sessão" }, { campo: "operador", cabecalho: "Operador" },
                { campo: "contado", cabecalho: "Contado", render: v => moeda(Number(v)) }, { campo: "valor", cabecalho: "A recolher", render: v => moeda(Number(v)) },
                { campo: "valorTroco", cabecalho: "Troco mantido", render: v => moeda(Number(v)) }, { campo: "responsavel", cabecalho: "Responsável" }, { campo: "data", cabecalho: "Fechamento", render: v => data(v as string) }]}
            acoes={[{ rotulo: "Destinar ou confirmar", icone: <CheckCircleOutlineRoundedIcon />, onClick: r => {
                setErroModal("");
                if (r.recolhimentoId) setConfirmacao(r);
                else { setForm({ ...novaEntregaCofre(), valor: String(r.contado), troco: "0" }); setModal(r); }
            } }]} vazio={{ titulo: "Nenhuma destinação pendente", descricao: "Sessões encerradas sem destinação aparecem aqui, respeitando seu acesso." }} />}
        {aba === 1 && <AppTable linhas={registros.items} obterChaveLinha={r => r.id} carregando={carregando} minWidth={1040} paginacao={paginacao}
            colunas={[{ campo: "sessaoId", cabecalho: "Sessão" }, { campo: "tipo", cabecalho: "Origem", render: v => v === "FECHAMENTO" ? "Fechamento" : v === "SANGRIA" ? "Sangria" : "Devolução para troco" }, { campo: "cofre", cabecalho: "Cofre" },
                { campo: "valor", cabecalho: "Valor", render: v => moeda(Number(v)) }, { campo: "valorTroco", cabecalho: "Troco mantido", render: v => moeda(Number(v)) },
                { campo: "operador", cabecalho: "Operador" }, { campo: "responsavel", cabecalho: "Responsável" }, { campo: "data", cabecalho: "Registro", render: v => data(v as string) },
                { campo: "dataConfirmacao", cabecalho: "Entrega", render: (_, r) => r.dataConfirmacao ? data(r.dataConfirmacao) : r.valor === 0 ? "Mantido para troco" : "Pendente" }, { campo: "observacao", cabecalho: "Observação" }]}
            acoes={[{ rotulo: "Confirmar entrega", icone: <CheckCircleOutlineRoundedIcon />, desabilitado: r => !!r.dataConfirmacao || !r.valor || (r.tipo !== "FECHAMENTO" && !gerencial), onClick: r => { setErroModal(""); setConfirmacao(r); } }]}
            vazio={{ titulo: "Nenhum recolhimento registrado", descricao: "A confirmação cria o vínculo com o movimento financeiro existente." }} />}
        {aba === 2 && <Stack spacing={1.5} sx={{ pt: 2 }}>
            <TextField select label="Cofre do extrato" value={conta} onChange={e => { setConta(e.target.value); setPagina(0); }}>
                <MenuItem value="">Selecione</MenuItem>{resumo?.contas.map(c => <MenuItem key={c.id} value={c.id}>{c.nome}{c.ativo ? "" : " (inativo)"}</MenuItem>)}
            </TextField>
            <Typography variant="body2" color="text.secondary">Depósitos usam a ação Transferir da conta COFRE para a conta BANCO, na lista abaixo. Outras saídas identificadas usam Movimentar. O extrato mantém o vínculo e a contraparte das transferências.</Typography>
            {conta && <AppTable linhas={movimentos.items} obterChaveLinha={r => r.id} carregando={carregando} minWidth={750} paginacao={paginacao}
                colunas={[{ campo: "dataCriacao", cabecalho: "Data/hora", render: v => data(v as string) }, { campo: "tipo", cabecalho: "Movimento" },
                    { campo: "descricao", cabecalho: "Identificação", render: (_, r) => <>{r.descricao}{r.contaContraparteNome ? ` · ${r.contaContraparteNome}` : ""}{r.estornada && <Chip size="small" label="Estornado" />}</> },
                    { campo: "valor", cabecalho: "Valor", render: v => moeda(Number(v)) }, { campo: "usuarioNome", cabecalho: "Operador" }, { campo: "observacao", cabecalho: "Observação" }]}
                vazio={{ titulo: "Nenhum movimento no cofre", descricao: "Recolhimentos pendentes não entram no saldo nem neste extrato." }} />}
        </Stack>}
        <Dialog open={modal !== null} fullWidth maxWidth="sm" onClose={processando ? undefined : () => setModal(null)} aria-labelledby="cofre-form-titulo">
            <Box component="form" onSubmit={salvar} sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
                <DialogTitle id="cofre-form-titulo">{modal === "devolver" ? "Devolver dinheiro para troco" : `Destinar dinheiro da sessão #${modal?.sessaoId}`}</DialogTitle>
                <DialogContent dividers><Stack spacing={2}>
                    {erroModal && <Alert severity="error">{erroModal}</Alert>}
                    {modal === "devolver" && <TextField select required label="Sessão aberta de destino" value={sessaoId} disabled={processando} onChange={e => setSessaoId(e.target.value)}>
                        {sessoes.map(s => <MenuItem key={s.sessaoId} value={s.sessaoId}>#{s.sessaoId} · {s.descricaoCaixa} · {s.operadorAbertura.nome}</MenuItem>)}
                    </TextField>}
                    <EntregaCofreCampos value={form} onChange={setForm} disabled={processando} devolucao={modal === "devolver"} />
                </Stack></DialogContent>
                <DialogActions><Button disabled={processando} onClick={() => setModal(null)}>Voltar</Button><Button type="submit" variant="contained" disabled={processando}>{processando ? "Registrando…" : "Registrar destinação"}</Button></DialogActions>
            </Box>
        </Dialog>
        <Dialog open={!!confirmacao} fullWidth maxWidth="xs" onClose={processando ? undefined : () => setConfirmacao(null)} aria-labelledby="cofre-confirmar-titulo">
            <DialogTitle id="cofre-confirmar-titulo">Confirmar entrega ao cofre?</DialogTitle>
            <DialogContent><Typography>Confirme somente após a entrega física: {confirmacao && moeda(confirmacao.valor)} · sessão #{confirmacao?.sessaoId} · responsável: {confirmacao?.responsavel}.</Typography>
                {erroModal && <Alert severity="error" sx={{ mt: 2 }}>{erroModal}</Alert>}
            </DialogContent>
            <DialogActions><Button disabled={processando} onClick={() => setConfirmacao(null)}>Voltar</Button><Button variant="contained" disabled={processando} onClick={() => void confirmar()}>Confirmar entrega</Button></DialogActions>
        </Dialog>
    </Paper>;
}
