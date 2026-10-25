import { formatarDataHora } from "../../utils/dataHora";
import { useEffect, useState } from "react";
import { Alert, Autocomplete, Box, Button, Stack, Typography } from "@mui/material";
import type { Produto } from "../../types/produto";
import api from "../../services/api";
import { obterMensagemDaApi, pesquisarProdutos } from "../../services/produtoService";
import { useRemoteSearch } from "../../hooks/useRemoteSearch";
import type { LinhaComposicao } from "./composicaoProduto";
import CampoTexto from "../../components/ui/CampoTexto";
import CampoDecimal, { CampoQuantidade } from "../../components/ui/CampoDecimal";

type Historico = { id: number; versao: number; produtoId: number; nome: string; quantidade: number; fator: number; unidade: string; unidadeEstoque: string; data: string; usuarioId: number };
export default function ComposicaoProdutoCampos({ produtoId, valor, onChange, disabled }: {
    produtoId?: number; valor: LinhaComposicao[] | null; onChange: (linhas: LinhaComposicao[]) => void; disabled: boolean;
}) {
    const { term: busca, setTerm: setBusca } = useRemoteSearch<Produto>({
        enabled: !disabled,
        search: (termo, signal) => pesquisarProdutos(termo, signal),
        onResults: lista => setOpcoes(lista.filter(p => !p.composto && p.controlaEstoque && p.ativo && p.id !== produtoId)),
        onError: e => setErro(obterMensagemDaApi(e, "Não foi possível buscar os componentes.")),
    });
    const [opcoes, setOpcoes] = useState<Produto[]>([]);
    const [historico, setHistorico] = useState<Historico[]>([]);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    useEffect(() => {
        if (!produtoId) return;
        const c = new AbortController();
        api.get<Historico[]>(`/produtos/${produtoId}/composicoes`, { signal: c.signal }).then(r => {
            if (c.signal.aborted) return;
            setHistorico(r.data); setErro("");
            const versao = Math.max(0, ...r.data.map(l => l.versao));
            onChange(r.data.filter(l => l.versao === versao).map(l => ({ ...l, quantidade: String(l.quantidade), fator: String(l.fator) })));
        }).catch(e => { if (!c.signal.aborted) setErro(obterMensagemDaApi(e, "Não foi possível consultar a composição. Tente novamente antes de editá-la.")); });
        return () => c.abort();
    }, [produtoId, tentativa, onChange]);
    function alterar(indice: number, patch: Partial<LinhaComposicao>) { onChange((valor ?? []).map((l, i) => i === indice ? { ...l, ...patch } : l)); }
    return <Stack component="section" spacing={1.5} sx={{ minWidth: 0 }} aria-label="Composição do Kit/Combo">
        <Typography component="h3" variant="subtitle1">Composição do Kit/Combo</Typography>
        <Typography variant="body2" color="text.secondary">Disponibilidade e custo vêm dos componentes. Quantidade × fator informa o consumo na unidade física por unidade vendida do Kit/Combo. Ex.: 1 CX × 6 UN/CX consome 6 UN.</Typography>
        {erro && <Alert severity="error" action={produtoId && valor === null ? <Button onClick={() => setTentativa(n => n + 1)}>Tentar novamente</Button> : undefined}>{erro}</Alert>}
        <Autocomplete options={opcoes} value={null} inputValue={busca} disabled={disabled || (!!produtoId && valor === null)} filterOptions={x => x}
            getOptionLabel={p => `${p.nome} · ${p.codigoInterno ?? p.id} · ${p.unidadeMedida}`} onInputChange={(_, v) => setBusca(v)}
            onChange={(_, p) => { if (p && !(valor ?? []).some(l => l.produtoId === p.id)) onChange([...(valor ?? []), { produtoId: p.id, nome: p.nome, unidadeEstoque: p.unidadeMedida, unidade: p.unidadeMedida, quantidade: "1", fator: "1" }]); setBusca(""); }}
            noOptionsText="Busque um produto físico simples" renderInput={params => <CampoTexto {...params} label="Adicionar componente por nome, código ou EAN" placeholder="Nome, código ou EAN…" name="buscaComponente" autoComplete="off" />} />
        {(valor ?? []).map((l, i) => <Box key={l.produtoId} sx={{ borderBottom: 1, borderColor: "divider", pb: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere", mb: 1 }}>{l.nome} · estoque em {l.unidadeEstoque}</Typography>
            <Stack sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr)) auto" }, gap: 1 }}>
                <CampoQuantidade canonico label="Quantidade" name={`quantidadeComponente${i}`} value={l.quantidade} disabled={disabled} onValueChange={v => alterar(i, { quantidade: v })} placeholder="Ex.: 1,250…" helperText="Quantidade positiva. Até 3 casas decimais." />
                <CampoTexto label="Unidade informada" placeholder="Ex.: UN, KG, CX…" name={`unidadeComponente${i}`} value={l.unidade} disabled={disabled} onChange={e => alterar(i, { unidade: e.target.value })} slotProps={{ htmlInput: { maxLength: 10 } }} />
                <CampoDecimal canonico casas={6} label={`Fator para ${l.unidadeEstoque}`} name={`fatorComponente${i}`} value={l.fator} disabled={disabled} onValueChange={v => alterar(i, { fator: v })} placeholder="Ex.: 0,000001…" helperText="Conversão para estoque. Até 6 casas decimais." />
                <Button color="error" disabled={disabled} aria-label={`Remover componente ${l.nome}`} onClick={() => onChange((valor ?? []).filter((_, index) => index !== i))}>Remover</Button>
            </Stack>
        </Box>)}
        {produtoId && valor === null && !erro && <Typography role="status">Carregando composição…</Typography>}
        {historico.length > 0 && <Box component="details"><Typography component="summary" sx={{ cursor: "pointer" }}>Histórico da composição ({new Set(historico.map(l => l.versao)).size} versões)</Typography>
            {historico.map(l => <Typography key={l.id} variant="body2">v{l.versao} · {l.nome} · {l.quantidade} {l.unidade} × {l.fator} · {formatarDataHora(l.data)} · usuário #{l.usuarioId}</Typography>)}
        </Box>}
    </Stack>;
}
