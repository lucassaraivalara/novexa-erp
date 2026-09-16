import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
    Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, FormControlLabel, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import type { Cliente, ClienteInput, ContatoCliente, EnderecoCliente } from "../../types/cliente";
import { mensagemCliente, salvarCliente } from "../../services/clienteService";
import CadastroDialog from "../../components/ui/CadastroDialog";

type Props = { cliente: Cliente | null; empresaId: number; onFechar: () => void; onSalvo: (cliente: Cliente) => void };
type Aba = "gerais" | "enderecos" | "contatos" | "comercial" | "observacoes";
const novoEndereco = (): EnderecoCliente => ({ logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", cep: "", principal: true, entrega: true });
const novoContato = (): ContatoCliente => ({ nome: "", cargo: "", telefone: "", email: "" });

export default function ClienteForm({ cliente, empresaId, onFechar, onSalvo }: Props) {
    const [aba, setAba] = useState<Aba>("gerais");
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [confirmarSaida, setConfirmarSaida] = useState(false);
    const [alterado, setAlterado] = useState(false);
    const [enderecoAberto, setEnderecoAberto] = useState<number | null>(null);
    const [contatoAberto, setContatoAberto] = useState<number | null>(null);
    const [form, setForm] = useState<ClienteInput>(() => ({
        empresaId, nome: cliente?.nome ?? "", nomeFantasia: cliente?.nomeFantasia ?? "", tipoPessoa: cliente?.tipoPessoa ?? "JURIDICA",
        cpfCnpj: cliente?.cpfCnpj ?? "", inscricaoEstadual: cliente?.inscricaoEstadual ?? "", email: cliente?.email ?? "", telefone: cliente?.telefone ?? "",
        endereco: cliente?.endereco ?? "", ativo: cliente?.ativo ?? true, enderecos: cliente?.enderecos ?? [], contatos: cliente?.contatos ?? [],
        vendedor: cliente?.vendedor ?? "", condicaoPagamento: cliente?.condicaoPagamento ?? "", limiteCredito: cliente?.limiteCredito ?? null,
        observacoesInternas: cliente?.observacoesInternas ?? "", instrucoesEntrega: cliente?.instrucoesEntrega ?? "",
    }));
    const titulo = cliente ? "Editar cliente" : "Novo cliente";
    const marcar = <T extends keyof ClienteInput>(campo: T, valor: ClienteInput[T]) => { setForm(atual => ({ ...atual, [campo]: valor })); setAlterado(true); setErro(""); };
    const cidades = useMemo(() => form.enderecos.filter(e => e.cidade).map(e => `${e.cidade} / ${e.uf}`).join(", "), [form.enderecos]);

    function fechar() { if (salvando) return; if (alterado) setConfirmarSaida(true); else onFechar(); }
    function adicionarEndereco(endereco: EnderecoCliente) {
        const enderecos = [...form.enderecos, endereco];
        if (endereco.principal) enderecos.forEach((e, i) => { if (i !== enderecos.length - 1) e.principal = false; });
        marcar("enderecos", enderecos);
    }
    function editarEndereco(index: number, endereco: EnderecoCliente) {
        const enderecos = [...form.enderecos];
        if (endereco.principal) enderecos.forEach((e, i) => { if (i !== index) e.principal = false; });
        enderecos[index] = endereco; marcar("enderecos", enderecos);
    }
    function excluirEndereco(index: number) { marcar("enderecos", form.enderecos.filter((_, i) => i !== index)); setEnderecoAberto(null); }
    function adicionarContato(contato: ContatoCliente) { marcar("contatos", [...form.contatos, contato]); }
    function editarContato(index: number, contato: ContatoCliente) { const contatos = [...form.contatos]; contatos[index] = contato; marcar("contatos", contatos); }
    function excluirContato(index: number) { marcar("contatos", form.contatos.filter((_, i) => i !== index)); setContatoAberto(null); }
    async function enviar(evento: FormEvent) {
        evento.preventDefault();
        if (salvando) return;
        if (!form.nome.trim()) { setErro("Informe o nome ou razão social do cliente."); setAba("gerais"); return; }
        if (form.cpfCnpj && !/^([\d.\-/\s]{11,18})$/.test(form.cpfCnpj)) { setErro("Informe um CPF ou CNPJ válido."); setAba("gerais"); return; }
        setSalvando(true); setErro("");
        try { const salvo = await salvarCliente({ ...form, nome: form.nome.trim(), empresaId }, cliente?.id); setAlterado(false); onSalvo(salvo); }
        catch (e) { setErro(mensagemCliente(e, "Não foi possível salvar o cliente.")); }
        finally { setSalvando(false); }
    }
    const abas: { value: Aba; label: string }[] = [{ value: "gerais", label: "Dados Gerais" }, { value: "enderecos", label: "Endereços" }, { value: "contatos", label: "Contatos" }, { value: "comercial", label: "Comercial e Financeiro" }, { value: "observacoes", label: "Observações" }];
    return <>
        <CadastroDialog
            aberto
            variante="full"
            titulo={titulo}
            descricao={cliente ? `Código ${cliente.id} · revise e salve as alterações` : "Cadastre os dados principais e complete o que for necessário"}
            salvando={salvando}
            textoSalvar="Salvar cliente"
            onFechar={fechar}
            onSubmit={enviar}
            navegacao={<Tabs value={aba} onChange={(_, value) => setAba(value)} variant="scrollable" scrollButtons="auto"
                sx={{ px: { xs: 1, sm: 3 } }}>{abas.map(item => <Tab key={item.value} value={item.value} label={item.label} />)}</Tabs>}>
                {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
                {aba === "gerais" && <Stack spacing={2}><Section title="Identificação"><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 2 }}><TextField required autoFocus label="Nome / Razão social" value={form.nome} onChange={e => marcar("nome", e.target.value)} /><TextField label="Nome fantasia" value={form.nomeFantasia} onChange={e => marcar("nomeFantasia", e.target.value)} /><TextField select label="Tipo de pessoa" value={form.tipoPessoa} onChange={e => marcar("tipoPessoa", e.target.value as ClienteInput["tipoPessoa"])}><MenuItem value="JURIDICA">Pessoa jurídica</MenuItem><MenuItem value="FISICA">Pessoa física</MenuItem></TextField><TextField label={form.tipoPessoa === "JURIDICA" ? "CNPJ" : "CPF"} value={form.cpfCnpj} onChange={e => marcar("cpfCnpj", e.target.value)} /><TextField label="Inscrição estadual" value={form.inscricaoEstadual} onChange={e => marcar("inscricaoEstadual", e.target.value)} /><FormControlLabel control={<Checkbox checked={form.ativo} onChange={e => marcar("ativo", e.target.checked)} />} label="Cliente ativo" /></Box></Section><Section title="Contato principal"><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}><TextField label="Telefone" value={form.telefone} onChange={e => marcar("telefone", e.target.value)} /><TextField label="E-mail" type="email" value={form.email} onChange={e => marcar("email", e.target.value)} /></Box></Section></Stack>}
                {aba === "enderecos" && <Stack spacing={2}><Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><Box><Typography variant="h6">Endereços</Typography><Typography color="text.secondary" variant="body2">{cidades || "Adicione endereço de cobrança ou entrega."}</Typography></Box><Button variant="outlined" onClick={() => setEnderecoAberto(-1)}>Adicionar endereço</Button></Stack>{form.enderecos.length === 0 && <Empty text="Nenhum endereço cadastrado." />}{form.enderecos.map((e, i) => <Paper key={i} variant="outlined" sx={{ p: 2 }}><Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><Box><Typography sx={{ fontWeight: 600 }}>{e.logradouro || "Endereço sem identificação"}{e.numero ? `, ${e.numero}` : ""}</Typography><Typography variant="body2" color="text.secondary">{[e.bairro, e.cidade && `${e.cidade}/${e.uf}`, e.cep].filter(Boolean).join(" · ") || "Preencha os dados do endereço"}</Typography><Stack direction="row" spacing={1} sx={{ mt: 1 }}>{e.principal && <Typography variant="caption" color="primary">Principal</Typography>}{e.entrega && <Typography variant="caption" color="primary">Entrega</Typography>}</Stack></Box><Stack direction="row" spacing={1}><Button size="small" onClick={() => setEnderecoAberto(i)}>Editar</Button><Button size="small" color="error" onClick={() => excluirEndereco(i)}>Remover</Button></Stack></Stack></Paper>)}{enderecoAberto !== null && <EnderecoDialog endereco={enderecoAberto === -1 ? novoEndereco() : form.enderecos[enderecoAberto]} onClose={() => setEnderecoAberto(null)} onSave={e => { if (enderecoAberto === -1) adicionarEndereco(e); else editarEndereco(enderecoAberto, e); setEnderecoAberto(null); }} />}</Stack>}
                {aba === "contatos" && <Stack spacing={2}><Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><Box><Typography variant="h6">Contatos</Typography><Typography color="text.secondary" variant="body2">Pessoas que facilitam o atendimento comercial.</Typography></Box><Button variant="outlined" onClick={() => setContatoAberto(-1)}>Adicionar contato</Button></Stack>{form.contatos.length === 0 && <Empty text="Nenhum contato adicional cadastrado." />}{form.contatos.map((c, i) => <Paper key={i} variant="outlined" sx={{ p: 2 }}><Stack direction="row" sx={{ justifyContent: "space-between" }}><Box><Typography sx={{ fontWeight: 600 }}>{c.nome || "Contato sem nome"}</Typography><Typography variant="body2" color="text.secondary">{[c.cargo, c.telefone, c.email].filter(Boolean).join(" · ")}</Typography></Box><Stack direction="row" spacing={1}><Button size="small" onClick={() => setContatoAberto(i)}>Editar</Button><Button size="small" color="error" onClick={() => excluirContato(i)}>Remover</Button></Stack></Stack></Paper>)}{contatoAberto !== null && <ContatoDialog contato={contatoAberto === -1 ? novoContato() : form.contatos[contatoAberto]} onClose={() => setContatoAberto(null)} onSave={c => { if (contatoAberto === -1) adicionarContato(c); else editarContato(contatoAberto, c); setContatoAberto(null); }} />}</Stack>}
                {aba === "comercial" && <Stack spacing={2}><Section title="Condições básicas"><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}><TextField label="Vendedor responsável" value={form.vendedor} onChange={e => marcar("vendedor", e.target.value)} helperText="Campo livre nesta primeira versão" /><TextField label="Condição de pagamento" value={form.condicaoPagamento} onChange={e => marcar("condicaoPagamento", e.target.value)} placeholder="Ex.: à vista, 28 dias" /><TextField label="Limite de crédito" type="number" slotProps={{ htmlInput: { min: 0, step: .01 } }} value={form.limiteCredito ?? ""} onChange={e => marcar("limiteCredito", e.target.value === "" ? null : Number(e.target.value))} /></Box></Section></Stack>}
                {aba === "observacoes" && <Stack spacing={2}><Section title="Notas internas"><TextField multiline minRows={5} label="Observações internas" value={form.observacoesInternas} onChange={e => marcar("observacoesInternas", e.target.value)} /></Section><Section title="Entrega"><TextField multiline minRows={5} label="Instruções de entrega" value={form.instrucoesEntrega} onChange={e => marcar("instrucoesEntrega", e.target.value)} helperText="Horários, acesso, cuidados e preferências do cliente." /></Section></Stack>}
        </CadastroDialog>
        <Dialog open={confirmarSaida} onClose={() => setConfirmarSaida(false)}><DialogTitle>Descartar alterações?</DialogTitle><DialogContent>Você alterou dados deste cliente. Se sair agora, essas alterações serão perdidas.</DialogContent><DialogActions><Button onClick={() => setConfirmarSaida(false)}>Continuar editando</Button><Button color="error" onClick={onFechar}>Descartar</Button></DialogActions></Dialog>
    </>;
}
function Section({ title, children }: { title: string; children: ReactNode }) { return <Stack spacing={1}><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography><Divider />{children}</Stack>; }
function Empty({ text }: { text: string }) { return <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}><Typography color="text.secondary">{text}</Typography></Paper>; }
function EnderecoDialog({ endereco, onClose, onSave }: { endereco: EnderecoCliente; onClose: () => void; onSave: (e: EnderecoCliente) => void }) { const [e, setE] = useState(endereco); const set = (k: keyof EnderecoCliente, v: string | boolean) => setE(a => ({ ...a, [k]: v })); return <Dialog open onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>Endereço</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Box sx={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 2 }}><TextField autoFocus label="Logradouro" value={e.logradouro} onChange={x => set("logradouro", x.target.value)} /><TextField label="Número" value={e.numero} onChange={x => set("numero", x.target.value)} /></Box><TextField label="Complemento" value={e.complemento} onChange={x => set("complemento", x.target.value)} /><Box sx={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 2 }}><TextField label="Bairro" value={e.bairro} onChange={x => set("bairro", x.target.value)} /><TextField label="UF" value={e.uf} slotProps={{ htmlInput: { maxLength: 2 } }} onChange={x => set("uf", x.target.value.toUpperCase())} /></Box><Box sx={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 2 }}><TextField label="Cidade" value={e.cidade} onChange={x => set("cidade", x.target.value)} /><TextField label="CEP" value={e.cep} onChange={x => set("cep", x.target.value)} /></Box><Stack direction="row"><FormControlLabel control={<Checkbox checked={e.principal} onChange={x => set("principal", x.target.checked)} />} label="Endereço principal" /><FormControlLabel control={<Checkbox checked={e.entrega} onChange={x => set("entrega", x.target.checked)} />} label="Usar para entrega" /></Stack></Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancelar</Button><Button variant="contained" onClick={() => onSave(e)}>Usar endereço</Button></DialogActions></Dialog>; }
function ContatoDialog({ contato, onClose, onSave }: { contato: ContatoCliente; onClose: () => void; onSave: (c: ContatoCliente) => void }) { const [c, setC] = useState(contato); const set = (k: keyof ContatoCliente, v: string) => setC(a => ({ ...a, [k]: v })); return <Dialog open onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>Contato</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField autoFocus label="Nome" value={c.nome} onChange={x => set("nome", x.target.value)} /><TextField label="Cargo / função" value={c.cargo} onChange={x => set("cargo", x.target.value)} /><TextField label="Telefone" value={c.telefone} onChange={x => set("telefone", x.target.value)} /><TextField label="E-mail" type="email" value={c.email} onChange={x => set("email", x.target.value)} /></Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancelar</Button><Button variant="contained" onClick={() => onSave(c)}>Usar contato</Button></DialogActions></Dialog>; }
