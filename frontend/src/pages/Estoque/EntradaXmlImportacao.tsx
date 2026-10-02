import { useRef, useState, type FormEvent } from "react";
import { Alert, Stack, TextField, Typography } from "@mui/material";
import CadastroDialog from "../../components/ui/CadastroDialog";
import { importarXmlEntrada, limiteArquivoXml, mensagemPreviewXml } from "../../services/entradaMercadoriaService";
import type { EntradaMercadoria, EntradaXmlPreview } from "../../types/entradaMercadoria";
import EntradaMercadoriaForm from "./EntradaMercadoriaForm";

export default function EntradaXmlImportacao({ onFechar, onConcluido, onAtualizar }: {
    onFechar: () => void; onConcluido: (entrada: EntradaMercadoria) => void; onAtualizar: () => void;
}) {
    const [arquivo, setArquivo] = useState<File | null>(null);
    const [preview, setPreview] = useState<EntradaXmlPreview | null>(null);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState("");
    const ocupado = useRef(false);

    async function processar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (ocupado.current) return;
        if (!arquivo || !/\.xml$/i.test(arquivo.name)) { setErro("Selecione um arquivo .xml de NF-e."); return; }
        if (!arquivo.size) { setErro("O arquivo XML está vazio."); return; }
        if (arquivo.size > limiteArquivoXml) { setErro("O arquivo XML deve ter no máximo 2 MB."); return; }
        ocupado.current = true; setCarregando(true); setErro("");
        try { setPreview(await importarXmlEntrada(arquivo)); }
        catch (e) { setErro(mensagemPreviewXml(e)); }
        finally { ocupado.current = false; setCarregando(false); }
    }

    if (preview) return <EntradaMercadoriaForm entrada={null} previewXml={preview}
        onFechar={onFechar} onConcluido={onConcluido} onAtualizar={onAtualizar} />;
    return <CadastroDialog aberto variante="compact" titulo="Importar XML NF-e" textoSalvar="Processar XML"
        salvando={carregando} desabilitarSalvar={!arquivo} onSubmit={processar} onFechar={onFechar}>
        <Stack spacing={2}>
            {erro && <Alert severity="error">{erro}</Alert>}
            <TextField type="file" label="Arquivo XML" disabled={carregando}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { accept: ".xml" } }}
                onChange={e => { setArquivo((e.target as HTMLInputElement).files?.[0] ?? null); setErro(""); }} />
            <Typography variant="body2" color="text.secondary">Uma NF-e por arquivo, até 2 MB. Revise os dados antes de confirmar a entrada.</Typography>
            {carregando && <Typography role="status">Processando XML…</Typography>}
        </Stack>
    </CadastroDialog>;
}
