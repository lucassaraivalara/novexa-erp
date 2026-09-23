import { useEffect, useRef, useState, type FormEvent } from "react";
import { useBlocker } from "react-router-dom";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
    Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControlLabel, IconButton, Link, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import { buscarCoordenadas, consultarGeocodificacao, mensagemEmpresa, salvarEmpresa } from "../../services/empresaService";
import type { CoordenadaEmpresa, EmpresaCompleta, InscricaoSt } from "../../types/empresa";
import { formatarDocumentoEmpresa } from "../../utils/validators/documentoEmpresa";
import { abasEmpresa, criarFormulario, gerarInput, gruposEmpresa, lerCampo, ufs, validarFormulario, type Campo, type NomeCampo } from "./empresaFormulario";

type Props = { empresa: EmpresaCompleta | null; abaInicial?: number; onFechar: () => void; onSalvo: (empresa: EmpresaCompleta) => void };

export default function EmpresaForm({ empresa, abaInicial = 0, onFechar, onSalvo }: Props) {
    const [inicial] = useState(() => criarFormulario(empresa));
    const [form, setForm] = useState(inicial);
    const [aba, setAba] = useState(abaInicial);
    const [erros, setErros] = useState<Record<string, string>>({});
    const [erro, setErro] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [lendoLogo, setLendoLogo] = useState(false);
    const [confirmarSaida, setConfirmarSaida] = useState(false);
    const [inscricaoAlterada, setInscricaoAlterada] = useState(false);
    const [geoConfigurado, setGeoConfigurado] = useState<boolean | null>(null);
    const [geoErro, setGeoErro] = useState("");
    const [buscandoGeo, setBuscandoGeo] = useState(false);
    const [coordenadas, setCoordenadas] = useState<CoordenadaEmpresa[]>([]);
    const [geoConsultado, setGeoConsultado] = useState(false);
    const leituraLogo = useRef({ id: 0 });
    const geoRequest = useRef<AbortController | null>(null);
    const alterado = JSON.stringify(form) !== JSON.stringify(inicial) || inscricaoAlterada;
    const bloqueio = useBlocker(alterado || salvando);

    useEffect(() => {
        const controller = new AbortController();
        const leitura = leituraLogo.current;
        consultarGeocodificacao(controller.signal).then(dados => setGeoConfigurado(dados.configurado)).catch(() => {
            if (!controller.signal.aborted) { setGeoConfigurado(false); setGeoErro("Não foi possível verificar o serviço de coordenadas."); }
        });
        return () => { controller.abort(); geoRequest.current?.abort(); leitura.id++; };
    }, []);
    useEffect(() => {
        const avisar = (e: BeforeUnloadEvent) => { if (alterado || salvando) { e.preventDefault(); e.returnValue = ""; } };
        window.addEventListener("beforeunload", avisar);
        return () => window.removeEventListener("beforeunload", avisar);
    }, [alterado, salvando]);

    function alterar(campo: NomeCampo, valor: string | boolean) {
        setForm(atual => campo.startsWith("cadastro.")
            ? { ...atual, cadastro: { ...atual.cadastro, [campo.slice(9)]: valor } }
            : { ...atual, [campo]: valor });
        setErros(atual => ({ ...atual, [campo]: "" }));
        setErro("");
        if (["cadastro.logradouro", "cadastro.numero", "cadastro.cidade", "cadastro.uf", "cadastro.cep"].includes(campo)) {
            geoRequest.current?.abort(); setBuscandoGeo(false); setCoordenadas([]); setGeoConsultado(false);
        }
    }
    function fechar() {
        if (salvando || lendoLogo) return;
        if (alterado) setConfirmarSaida(true); else onFechar();
    }
    function continuar() { setConfirmarSaida(false); if (bloqueio.state === "blocked") bloqueio.reset(); }
    function descartar() { if (bloqueio.state === "blocked") bloqueio.proceed(); else onFechar(); }

    async function salvar(e: FormEvent) {
        e.preventDefault();
        if (salvando || lendoLogo || inscricaoAlterada) return;
        const encontrados = validarFormulario(form);
        setErros(encontrados);
        if (Object.keys(encontrados).length) {
            const grupo = gruposEmpresa.find(g => g.campos.some(c => encontrados[c.nome]));
            setAba(grupo?.aba ?? 3); setErro("Revise os campos indicados antes de salvar."); return;
        }
        setSalvando(true); setErro("");
        try { onSalvo(await salvarEmpresa(gerarInput(form), empresa?.id)); }
        catch (e) { setErro(mensagemEmpresa(e, "Não foi possível salvar a empresa.")); }
        finally { setSalvando(false); }
    }

    async function carregarLogo(file: File | undefined) {
        if (!file) return;
        const pedido = ++leituraLogo.current.id;
        setErro("");
        if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 1048576) { setErro("Selecione uma imagem PNG ou JPEG de até 1 MB."); return; }
        setLendoLogo(true);
        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const leitor = new FileReader(); leitor.onload = () => resolve(String(leitor.result)); leitor.onerror = reject; leitor.readAsDataURL(file);
            });
            const imagem = new Image(); imagem.src = dataUrl; await imagem.decode();
            if (imagem.naturalWidth > 2048 || imagem.naturalHeight > 2048) throw new Error("dimensoes");
            if (pedido === leituraLogo.current.id) setForm(atual => ({ ...atual, logomarca: dataUrl }));
        } catch { if (pedido === leituraLogo.current.id) setErro("Use uma imagem válida de até 2048 × 2048 pixels."); }
        finally { if (pedido === leituraLogo.current.id) setLendoLogo(false); }
    }

    async function localizar() {
        const c = form.cadastro;
        if (!c.logradouro.trim() || !c.cidade.trim() || !c.uf) { setGeoErro("Preencha logradouro, cidade e UF para buscar coordenadas."); return; }
        geoRequest.current?.abort();
        const controller = new AbortController(); geoRequest.current = controller;
        setBuscandoGeo(true); setGeoErro(""); setCoordenadas([]); setGeoConsultado(false);
        try {
            const resultados = await buscarCoordenadas([c.logradouro, c.numero, c.cidade, c.uf, c.cep, "Brasil"].filter(Boolean).join(", "), controller.signal);
            if (!controller.signal.aborted) { setCoordenadas(resultados); setGeoConsultado(true); }
        } catch (e) { if (!controller.signal.aborted) setGeoErro(mensagemEmpresa(e, "Não foi possível buscar as coordenadas.")); }
        finally { if (!controller.signal.aborted) setBuscandoGeo(false); }
    }

    function campo(item: Campo) {
        const valor = lerCampo(form, item.nome);
        const documento = item.nome === "cnpj";
        const autoComplete = item.nome === "razaoSocial" || item.nome === "nomeFantasia" ? "organization"
            : item.nome === "email" ? "email"
                : item.nome === "telefone" ? "tel"
                    : item.nome === "cadastro.cep" ? "postal-code"
                        : item.nome === "cadastro.logradouro" ? "street-address"
                            : item.nome === "cadastro.cidade" ? "address-level2"
                                : item.nome === "cadastro.uf" ? "address-level1" : "off";
        const inputMode: "numeric" | "decimal" | "tel" | undefined = item.nome === "telefone" ? "tel"
            : item.tipo === "digitos" ? "numeric" : item.tipo === "decimal" ? "decimal" : undefined;
        return <TextField key={item.nome} name={item.nome} label={item.label} required={item.required} autoComplete={autoComplete} autoFocus={item.nome === gruposEmpresa[0]?.campos[0]?.nome} fullWidth
            value={documento ? formatarDocumentoEmpresa(valor, form.cadastro.produtorRural) : valor} select={!!item.opcoes} type={item.nome === "telefone" ? "tel" : item.tipo === "email" ? "email" : "text"}
            error={!!erros[item.nome]} helperText={erros[item.nome] || item.ajuda}
            slotProps={{ htmlInput: { maxLength: item.max, inputMode } }}
            onChange={e => alterar(item.nome, documento ? formatarDocumentoEmpresa(e.target.value, form.cadastro.produtorRural) : item.tipo === "digitos" ? e.target.value.replace(/\D/g, "") : e.target.value)}>
            {item.opcoes && [<MenuItem key="vazio" value="">Não informado</MenuItem>, ...item.opcoes.map(([valor, label]) => <MenuItem key={valor} value={valor}>{label}</MenuItem>)]}
        </TextField>;
    }

    return <Dialog open fullWidth maxWidth="lg" onClose={fechar} aria-labelledby="empresa-form-titulo">
        <Box component="form" noValidate onSubmit={salvar} sx={{ display: "flex", flexDirection: "column", minHeight: 0, maxHeight: "inherit" }}>
            <DialogTitle id="empresa-form-titulo" sx={{ pb: 1, position: "relative" }}>
                {empresa ? `Editar empresa · ${empresa.id}` : "Nova Empresa"}
                <Typography component="p" color="text.secondary" sx={{ fontSize: ".875rem", mt: .5 }}>Dados cadastrais, endereço e informações fiscais da empresa.</Typography>
                <IconButton type="button" aria-label="Fechar" onClick={fechar} disabled={salvando || lendoLogo} sx={{ position: "absolute", top: 8, right: 12 }}>
                    <CloseRoundedIcon />
                </IconButton>
            </DialogTitle>
            <Tabs value={aba} onChange={(_, valor) => setAba(valor)} variant="scrollable" scrollButtons="auto" aria-label="Abas do cadastro de empresa" sx={{ px: 3, borderBottom: 1, borderColor: "divider" }}>
                {abasEmpresa.map((label, index) => <Tab key={label} id={`empresa-tab-${index}`} aria-controls={`empresa-painel-${index}`} label={label} disabled={salvando} />)}
            </Tabs>
            <DialogContent sx={{ minHeight: 350 }}>
                {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
                <Box component="fieldset" disabled={salvando || lendoLogo} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
                    {abasEmpresa.map((label, index) => <Box key={label} role="tabpanel" id={`empresa-painel-${index}`} aria-labelledby={`empresa-tab-${index}`} hidden={aba !== index}>
                        <Stack spacing={3}>
                            {index === 0 && <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
                                <FormControlLabel control={<Checkbox slotProps={{ input: { name: "cadastro.produtorRural" } }} checked={form.cadastro.produtorRural} onChange={e => alterar("cadastro.produtorRural", e.target.checked)} />} label="Produtor rural" />
                                <FormControlLabel control={<Checkbox slotProps={{ input: { name: "ativo" } }} checked={form.ativo} onChange={e => alterar("ativo", e.target.checked)} />} label="Empresa ativa" />
                            </Stack>}
                            {gruposEmpresa.filter(g => g.aba === index).map(grupo => <Stack key={grupo.titulo} spacing={2}>
                                <Typography sx={{ fontWeight: 700 }}>{grupo.titulo}</Typography>
                                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>{grupo.campos.map(campo)}</Box>
                            </Stack>)}
                            {index === 0 && <Paper variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: "center" }}>
                                {form.logomarca ? <Box component="img" src={form.logomarca} alt="Prévia da logomarca" sx={{ width: 120, height: 90, objectFit: "contain" }} /> : <Box sx={{ width: 120, height: 90, display: "grid", placeItems: "center", bgcolor: "background.default", borderRadius: 2 }}><Typography color="text.secondary" variant="caption">Sem logomarca</Typography></Box>}
                                <Stack spacing={1}><Typography sx={{ fontWeight: 600 }}>Logomarca</Typography><Typography variant="caption" color="text.secondary">PNG ou JPEG · até 1 MB · 2048 × 2048 pixels</Typography>
                                    <Stack direction="row" spacing={1}><Button type="button" component="label" variant="outlined" disabled={lendoLogo || salvando}>{lendoLogo ? "Lendo imagem…" : "Selecionar imagem"}<input name="logomarca" hidden type="file" accept="image/png,image/jpeg" onChange={e => { void carregarLogo(e.target.files?.[0]); e.target.value = ""; }} /></Button>
                                        {form.logomarca && <Button type="button" color="error" onClick={() => setForm(f => ({ ...f, logomarca: null }))}>Remover imagem</Button>}</Stack>
                                </Stack>
                            </Stack></Paper>}
                            {index === 1 && <Stack spacing={2}>
                                {form.endereco && <Alert severity="info">Endereço anterior preservado: {form.endereco}. Complete os campos estruturados acima para usar a localização.</Alert>}
                                {geoConfigurado === false && <Alert severity="info">{geoErro || "Busca de coordenadas aguardando configuração do serviço de mapas. Você pode informar latitude e longitude manualmente."}</Alert>}
                                <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                                    <Button type="button" variant="outlined" disabled={!geoConfigurado || buscandoGeo || salvando} onClick={() => void localizar()}>{buscandoGeo ? "Buscando…" : "Buscar coordenadas do endereço"}</Button>
                                    {geoConfigurado && <Typography variant="caption" color="text.secondary">O endereço será enviado ao serviço de mapas configurado.</Typography>}
                                </Stack>
                                {geoErro && geoConfigurado && <Alert severity="warning">{geoErro}</Alert>}
                                {geoConsultado && !coordenadas.length && <Alert severity="info">Nenhum endereço encontrado. Revise os dados ou informe as coordenadas manualmente.</Alert>}
                                {!!coordenadas.length && <Stack spacing={1}><Typography variant="body2">Confira o endereço e selecione a localização:</Typography>{coordenadas.map((c, i) => <Button type="button" key={i} variant="outlined" sx={{ justifyContent: "flex-start", textAlign: "left", textTransform: "none" }} onClick={() => {
                                    setForm(f => ({ ...f, cadastro: { ...f.cadastro, latitude: String(c.latitude), longitude: String(c.longitude) } }));
                                    setErros(e => ({ ...e, "cadastro.latitude": "", "cadastro.longitude": "" })); setCoordenadas([]); setGeoConsultado(false);
                                }}>{c.descricao} · {c.latitude}, {c.longitude}</Button>)}<Typography variant="caption">Dados: <Link href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</Link></Typography></Stack>}
                            </Stack>}
                            {index === 3 && <InscricoesSt valor={form.inscricoesSt} ufEmpresa={form.cadastro.uf} erro={erros.inscricoesSt} disabled={salvando}
                                onDirty={setInscricaoAlterada} onChange={valor => { setForm(f => ({ ...f, inscricoesSt: valor })); setErros(e => ({ ...e, inscricoesSt: "" })); }} />}
                        </Stack>
                    </Box>)}
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary" sx={{ mr: "auto" }}>{alterado ? "Alterações ainda não salvas" : "Campos com * são obrigatórios"}</Typography>
                <Button type="button" onClick={fechar} disabled={salvando || lendoLogo}>Cancelar</Button>
                <Button type="submit" variant="contained" disabled={salvando || lendoLogo}>{salvando ? "Salvando…" : "Salvar empresa"}</Button>
            </DialogActions>
        </Box>
        <Dialog open={confirmarSaida || bloqueio.state === "blocked"} onClose={continuar} aria-labelledby="descartar-empresa">
            <DialogTitle id="descartar-empresa">Descartar alterações?</DialogTitle><DialogContent>As alterações não salvas serão perdidas.</DialogContent>
            <DialogActions><Button type="button" onClick={continuar}>Continuar editando</Button><Button type="button" color="error" onClick={descartar} disabled={salvando}>Descartar</Button></DialogActions>
        </Dialog>
    </Dialog>;
}

function InscricoesSt({ valor, ufEmpresa, erro, disabled, onChange, onDirty }: { valor: InscricaoSt[]; ufEmpresa: string; erro?: string; disabled: boolean; onChange: (valor: InscricaoSt[]) => void; onDirty: (valor: boolean) => void }) {
    const [edicao, setEdicao] = useState<{ index: number; original: InscricaoSt; dados: InscricaoSt } | null>(null);
    const [erroLocal, setErroLocal] = useState("");
    function abrir(index: number) { const dados = index < 0 ? { uf: "", inscricaoEstadual: "", difal: false } : { ...valor[index] }; setEdicao({ index, original: dados, dados }); setErroLocal(""); }
    function alterar(dados: InscricaoSt) { if (!edicao) return; setEdicao({ ...edicao, dados }); onDirty(JSON.stringify(dados) !== JSON.stringify(edicao.original)); }
    function fechar() {
        if (edicao && JSON.stringify(edicao.dados) !== JSON.stringify(edicao.original) && !window.confirm("Descartar as alterações desta inscrição?")) return;
        setEdicao(null); onDirty(false);
    }
    function adicionar() {
        if (!edicao) return;
        const dados = { ...edicao.dados, inscricaoEstadual: edicao.dados.inscricaoEstadual.trim() };
        if (!ufs.includes(dados.uf) || !dados.inscricaoEstadual) { setErroLocal("Informe a UF e a inscrição estadual."); return; }
        if (dados.uf === ufEmpresa || valor.some((i, index) => index !== edicao.index && i.uf === dados.uf)) { setErroLocal("Selecione outra UF, ainda não cadastrada nesta lista."); return; }
        onChange(edicao.index < 0 ? [...valor, dados] : valor.map((i, index) => index === edicao.index ? dados : i));
        setEdicao(null); onDirty(false);
    }
    return <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 1 }}>
            <Box><Typography sx={{ fontWeight: 700 }}>Inscrições de Substituto Tributário (Outras UFs)</Typography><Typography color="text.secondary" variant="body2">IEST da NF-e / SPED e identificação para DIFAL — registro 0015.</Typography></Box>
            <Button type="button" variant="outlined" disabled={disabled || valor.length >= 26} onClick={() => abrir(-1)}>Adicionar inscrição</Button>
        </Stack>
        {erro && <Alert severity="error">{erro}</Alert>}
        {!valor.length && <Typography color="text.secondary">Nenhuma inscrição em outra UF cadastrada.</Typography>}
        {valor.map((i, index) => <Paper key={i.uf} variant="outlined" sx={{ p: 2 }}><Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Box><Typography sx={{ fontWeight: 600 }}>{i.uf} · IE {i.inscricaoEstadual}</Typography><Typography variant="caption">{i.difal ? "DIFAL EC 87/15" : "Substituição tributária"}</Typography></Box>
            <Box><Button type="button" disabled={disabled} onClick={() => abrir(index)} aria-label={`Editar inscrição ${i.uf}`}>Editar</Button><Button type="button" disabled={disabled} color="error" onClick={() => onChange(valor.filter((_, pos) => pos !== index))}>Remover</Button></Box>
        </Stack></Paper>)}
        <Dialog open={!!edicao} onClose={fechar} fullWidth maxWidth="sm" aria-labelledby="inscricao-st-titulo">
            <DialogTitle id="inscricao-st-titulo">{edicao?.index === -1 ? "Adicionar inscrição ST" : "Editar inscrição ST"}</DialogTitle>
            {edicao && <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
                {erroLocal && <Alert severity="error">{erroLocal}</Alert>}
                <TextField select name="uf" autoComplete="address-level1" label="UF da inscrição" value={edicao.dados.uf} onChange={e => alterar({ ...edicao.dados, uf: e.target.value })}>{ufs.filter(uf => uf !== ufEmpresa).map(uf => <MenuItem key={uf} value={uf}>{uf}</MenuItem>)}</TextField>
                <TextField autoFocus required name="inscricaoEstadual" autoComplete="off" label="Inscrição Estadual (IEST)" value={edicao.dados.inscricaoEstadual} slotProps={{ htmlInput: { maxLength: 20 } }} onChange={e => alterar({ ...edicao.dados, inscricaoEstadual: e.target.value })} />
                <FormControlLabel control={<Checkbox slotProps={{ input: { name: "difal" } }} checked={edicao.dados.difal} onChange={e => alterar({ ...edicao.dados, difal: e.target.checked })} />} label="Utilizada para DIFAL EC 87/15 (registro 0015)" />
            </Stack></DialogContent>}
            <DialogActions><Button type="button" onClick={fechar}>Cancelar</Button><Button type="button" variant="contained" onClick={adicionar}>Confirmar inscrição</Button></DialogActions>
        </Dialog>
    </Stack>;
}
