import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Checkbox, Divider, FormControl, FormControlLabel, FormLabel, Paper, Radio, RadioGroup, Skeleton, Stack, Typography } from "@mui/material";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import { consultarConfiguracaoRecebimentos, salvarConfiguracaoRecebimentos, type ConfiguracaoRecebimentos as Configuracao } from "../../services/configuracaoRecebimentosService";
import { mensagemRecebivel } from "../../services/recebivelService";
import { podeExecutarAcaoGerencial } from "../../utils/auth/perfis";
import { obterSessao } from "../../utils/auth/sessao";
export default function ConfiguracaoRecebimentos() {
    const [dados, setDados] = useState<Configuracao | null>(null);
    const [erro, setErro] = useState("");
    const [sucesso, setSucesso] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [tentativa, setTentativa] = useState(0);
    const enviando = useRef(false);
    const podeEditar = podeExecutarAcaoGerencial(obterSessao()?.perfil);
    useEffect(() => {
        const controller = new AbortController();
        consultarConfiguracaoRecebimentos(controller.signal).then(d => { if (!controller.signal.aborted) { setDados(d); setErro(""); } })
            .catch(e => { if (!controller.signal.aborted) setErro(mensagemRecebivel(e, "Não foi possível carregar as configurações.")); });
        return () => controller.abort();
    }, [tentativa]);
    async function salvar(evento: React.FormEvent) {
        evento.preventDefault();
        if (!dados || !podeEditar || enviando.current) return;
        enviando.current = true; setSalvando(true); setErro(""); setSucesso("");
        try { setDados(await salvarConfiguracaoRecebimentos(dados)); setSucesso("Configurações salvas. A política vale para novas operações; o histórico foi preservado."); }
        catch (e) { setErro(mensagemRecebivel(e, "Não foi possível salvar. Seus dados foram mantidos.")); }
        finally { enviando.current = false; setSalvando(false); }
    }
    return <PageContainer>
        <PageHeader titulo="Recebimentos e Caixa" descricao="Defina como registrar recebimentos e conferir o fechamento da empresa."
            acoesSecundarias={<Button component={Link} to="/configuracoes">Voltar às Configurações</Button>} />
        {erro && <Alert severity="error" action={!dados ? <Button color="inherit" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</Button> : undefined}>{erro}</Alert>}
        {sucesso && <Alert role="status" severity="success">{sucesso}</Alert>}
        {!dados && !erro && <Skeleton variant="rounded" height={280} />}
        {dados && <Paper variant="outlined" component="form" onSubmit={e => void salvar(e)} sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2.5} divider={<Divider />}>
                <FormControl disabled={salvando || !podeEditar}>
                    <FormLabel id="recebimentos-modo">Recebimentos no PDV</FormLabel>
                    <RadioGroup name="modoRecebimento" aria-labelledby="recebimentos-modo" value={dados.modo}
                        onChange={e => setDados({ ...dados, modo: e.target.value as Configuracao["modo"] })}>
                        <FormControlLabel value="SIMPLIFICADO" control={<Radio />} label="Simplificado" />
                        <Typography variant="body2" color="text.secondary">Indicado para operações rápidas de varejo. Ao concluir uma venda, PIX é registrado diretamente na conta vinculada. Cartões permanecem como recebíveis até a liquidação.</Typography>
                        <FormControlLabel value="CONTROLADO" control={<Radio />} label="Controlado" />
                        <Typography variant="body2" color="text.secondary">PIX permanece pendente para confirmação financeira posterior. Cartões permanecem pendentes para liquidação.</Typography>
                    </RadioGroup>
                </FormControl>
                <Stack spacing={1}>
                    <FormControl disabled={salvando || !podeEditar}>
                        <FormLabel id="recebimentos-conferencia">Conferência do fechamento de Caixa</FormLabel>
                        <RadioGroup name="modoConferencia" aria-labelledby="recebimentos-conferencia" value={dados.conferencia}
                            onChange={e => setDados({ ...dados, conferencia: e.target.value as Configuracao["conferencia"] })}>
                            <FormControlLabel value="POR_FORMA_PAGAMENTO" control={<Radio />} label="Por forma de pagamento" />
                            <FormControlLabel value="TOTAL" control={<Radio />} label="Total dos meios não dinheiro" />
                        </RadioGroup>
                    </FormControl>
                    <FormControlLabel control={<Checkbox checked={dados.exigirValoresInformadosNoFechamento} disabled={salvando || !podeEditar}
                        onChange={e => setDados({ ...dados, exigirValoresInformadosNoFechamento: e.target.checked })} />} label="Solicitar valores informados no fechamento" />
                    <Typography variant="body2" color="text.secondary">Esta conferência não movimenta contas financeiras. Dinheiro físico, troco e cofre são conferidos separadamente.</Typography>
                </Stack>
                <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
                    <Typography variant="body2" color="text.secondary">Registro operacional não é conciliação bancária. Alterar a política não confirma PIX antigo nem liquida cartões.</Typography>
                    {podeEditar ? <Button type="submit" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={salvando}>{salvando ? "Salvando…" : "Salvar configurações"}</Button>
                        : <Typography variant="body2">Somente administradores e gestores podem alterar estas configurações.</Typography>}
                </Stack>
            </Stack>
        </Paper>}
    </PageContainer>;
}
