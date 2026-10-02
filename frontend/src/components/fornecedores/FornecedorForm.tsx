import { useState, type FormEvent, type ReactNode } from "react";
import { Alert, Box, Divider, FormControlLabel, Stack, Switch, TextField, Typography } from "@mui/material";
import CadastroDialog from "../ui/CadastroDialog";
import { atualizarFornecedor, criarFornecedor, fornecedorParaInput, mensagemFornecedor } from "../../services/fornecedorService";
import type { FornecedorCompleto, FornecedorInput } from "../../types/fornecedor";
import { formatarDocumentoEmpresa } from "../../utils/validators/documentoEmpresa";

type Props = {
    modo: "completo" | "rapido";
    fornecedor?: FornecedorCompleto | null;
    onFechar: () => void;
    onSalvo: (fornecedor: FornecedorCompleto) => void;
};

type Campos = Record<"razaoSocial" | "nomeFantasia" | "cpfCnpj" | "telefone" | "email" | "cep" | "logradouro"
    | "numero" | "complemento" | "bairro" | "cidade" | "uf" | "observacao", string>;

const texto = (valor: string | null | undefined) => valor ?? "";
const nulo = (valor: string) => valor.trim() || null;

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
    return <Stack spacing={1}><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{titulo}</Typography><Divider />{children}</Stack>;
}
const grade = (colunas: string) => ({ display: "grid", gridTemplateColumns: { xs: "1fr", sm: colunas }, gap: 2 });

// Formulário único: "rapido" usado em outros fluxos (devolve o fornecedor criado em onSalvo); "completo" na manutenção.
export default function FornecedorForm({ modo, fornecedor = null, onFechar, onSalvo }: Props) {
    const rapido = modo === "rapido";
    const [form, setForm] = useState<Campos>(() => ({
        razaoSocial: texto(fornecedor?.razaoSocial), nomeFantasia: texto(fornecedor?.nomeFantasia),
        cpfCnpj: formatarDocumentoEmpresa(texto(fornecedor?.cpfCnpj), true), telefone: texto(fornecedor?.telefone),
        email: texto(fornecedor?.email), cep: texto(fornecedor?.cep), logradouro: texto(fornecedor?.logradouro),
        numero: texto(fornecedor?.numero), complemento: texto(fornecedor?.complemento), bairro: texto(fornecedor?.bairro),
        cidade: texto(fornecedor?.cidade), uf: texto(fornecedor?.uf), observacao: texto(fornecedor?.observacao),
    }));
    const [ativo, setAtivo] = useState(fornecedor?.ativo ?? true);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const definir = (campo: keyof Campos, valor: string) => { setForm((atual) => ({ ...atual, [campo]: valor })); setErro(""); };
    const campo = (nome: keyof Campos, rotulo: string, extra: object = {}) =>
        <TextField label={rotulo} name={nome} value={form[nome]} onChange={(e) => definir(nome, e.target.value)} {...extra} />;
    const documento = <TextField label="CPF/CNPJ" name="cpfCnpj" value={form.cpfCnpj}
        onChange={(e) => definir("cpfCnpj", formatarDocumentoEmpresa(e.target.value, true))} />;

    async function enviar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (salvando) return;
        if (!form.razaoSocial.trim()) { setErro("Informe o nome ou a razão social."); return; }
        const base = fornecedor ? fornecedorParaInput(fornecedor) : null;
        const dados: FornecedorInput = {
            ...(base ?? { inscricaoEstadual: null, endereco: null }),
            razaoSocial: form.razaoSocial.trim(), nomeFantasia: nulo(form.nomeFantasia), cpfCnpj: nulo(form.cpfCnpj),
            telefone: nulo(form.telefone), email: nulo(form.email), cep: nulo(form.cep), logradouro: nulo(form.logradouro),
            numero: nulo(form.numero), complemento: nulo(form.complemento), bairro: nulo(form.bairro), cidade: nulo(form.cidade),
            uf: nulo(form.uf), observacao: nulo(form.observacao), ativo: fornecedor ? ativo : undefined,
        };
        setSalvando(true); setErro("");
        try { onSalvo(fornecedor ? await atualizarFornecedor(fornecedor.id, dados) : await criarFornecedor(dados)); }
        catch (e) { setErro(mensagemFornecedor(e, "Não foi possível salvar o fornecedor.")); }
        finally { setSalvando(false); }
    }

    return <CadastroDialog aberto variante="compact" salvando={salvando} onFechar={onFechar} onSubmit={enviar}
        titulo={fornecedor ? "Editar fornecedor" : "Novo fornecedor"}
        descricao={rapido ? "Cadastro rápido: só o essencial." : undefined}
        textoSalvar={rapido ? "Cadastrar e selecionar" : "Salvar fornecedor"}>
        {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
        {rapido ? <Stack spacing={2}>
            {campo("razaoSocial", "Razão Social / Nome", { required: true, autoFocus: true, slotProps: { htmlInput: { maxLength: 150 } } })}
            <Box sx={grade("1fr 1fr")}>{documento}{campo("telefone", "Telefone", { slotProps: { htmlInput: { maxLength: 30 } } })}</Box>
            {campo("nomeFantasia", "Nome Fantasia", { slotProps: { htmlInput: { maxLength: 150 } } })}
        </Stack> : <Stack spacing={2.5}>
            <Secao titulo="Dados principais"><Box sx={grade("1fr 1fr")}>
                {campo("razaoSocial", "Razão Social / Nome", { required: true, autoFocus: true, slotProps: { htmlInput: { maxLength: 150 } } })}
                {campo("nomeFantasia", "Nome Fantasia", { slotProps: { htmlInput: { maxLength: 150 } } })}
                {documento}
                {fornecedor && <FormControlLabel control={<Switch checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />} label="Fornecedor ativo" />}
            </Box></Secao>
            <Secao titulo="Contato"><Box sx={grade("1fr 1fr")}>
                {campo("telefone", "Telefone", { slotProps: { htmlInput: { maxLength: 30 } } })}
                {campo("email", "E-mail", { type: "email", slotProps: { htmlInput: { maxLength: 150 } } })}
            </Box></Secao>
            <Secao titulo="Endereço"><Box sx={grade("160px 1fr 120px")}>
                {campo("cep", "CEP", { slotProps: { htmlInput: { maxLength: 9 } } })}
                {campo("logradouro", "Logradouro", { slotProps: { htmlInput: { maxLength: 150 } } })}
                {campo("numero", "Número", { slotProps: { htmlInput: { maxLength: 20 } } })}
            </Box><Box sx={grade("1fr 1fr")}>
                {campo("complemento", "Complemento", { slotProps: { htmlInput: { maxLength: 100 } } })}
                {campo("bairro", "Bairro", { slotProps: { htmlInput: { maxLength: 100 } } })}
            </Box><Box sx={grade("1fr 100px")}>
                {campo("cidade", "Cidade", { slotProps: { htmlInput: { maxLength: 100 } } })}
                <TextField label="UF" name="uf" value={form.uf} slotProps={{ htmlInput: { maxLength: 2 } }}
                    onChange={(e) => definir("uf", e.target.value.toUpperCase())} />
            </Box></Secao>
            <Secao titulo="Observação">
                {campo("observacao", "Observação", { multiline: true, minRows: 3, slotProps: { htmlInput: { maxLength: 2000 } } })}
            </Secao>
        </Stack>}
    </CadastroDialog>;
}
