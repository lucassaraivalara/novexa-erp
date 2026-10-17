package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.dto.ImportacaoProdutoDTO.Linha;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.mapper.ProdutoMapper;
import br.com.novexa.erp.security.UsuarioAutenticado;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import static br.com.novexa.erp.service.ProdutoPlanilhaReader.invalido;

@Service
public class ImportacaoProdutoService {
    private final ProdutoPlanilhaReader reader;
    private final ImportacaoProdutoRepository importacoes;
    private final EmpresaRepository empresas;
    private final ProdutoRepository produtos;
    private final CategoriaProdutoRepository categorias;
    private final SubcategoriaProdutoRepository subcategorias;
    private final MarcaRepository marcas;
    private final FornecedorRepository fornecedores;
    private final ProdutoService produtoService;
    private final ProdutoMapper mapper;
    private final ObjectMapper json;
    private final Validator validator;
    private static final Map<String,String> COLUNAS=Map.ofEntries(
        Map.entry("nome","nome"), Map.entry("codigo","codigoInterno"), Map.entry("eangtin","codigoBarras"),
        Map.entry("ean","codigoBarras"), Map.entry("gtin","codigoBarras"), Map.entry("preco","precoVenda"),
        Map.entry("unidade","unidadeMedida"), Map.entry("estoquemin","estoqueMinimo"), Map.entry("status","ativo"),
        Map.entry("categoria","categoria"), Map.entry("subcategoria","subcategoria"), Map.entry("marca","marca"),
        Map.entry("fornecedorprincipal","fornecedor"), Map.entry("ncm","ncm"), Map.entry("cest","cest"));
    private record EntradaLinha(int numero, Map<String,String> campos, List<String> erros) {}
    public ImportacaoProdutoService(ProdutoPlanilhaReader reader, ImportacaoProdutoRepository importacoes,
            EmpresaRepository empresas, ProdutoRepository produtos, CategoriaProdutoRepository categorias,
            SubcategoriaProdutoRepository subcategorias, MarcaRepository marcas, FornecedorRepository fornecedores,
            ProdutoService produtoService, ProdutoMapper mapper, ObjectMapper json, Validator validator) {
        this.reader=reader; this.importacoes=importacoes; this.empresas=empresas; this.produtos=produtos;
        this.categorias=categorias; this.subcategorias=subcategorias; this.marcas=marcas; this.fornecedores=fornecedores;
        this.produtoService=produtoService; this.mapper=mapper; this.json=json; this.validator=validator;
    }
    @Transactional
    public ImportacaoProdutoDTO previa(MultipartFile arquivo, UsuarioAutenticado usuario) {
        var planilha=reader.ler(arquivo);
        String hash;
        try { hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(arquivo.getBytes())); }
        catch(Exception e) { throw invalido("Não foi possível ler o arquivo."); }
        bloquearEmpresa(usuario.empresaId());
        var registro=importacoes.findByEmpresaIdAndHashArquivo(usuario.empresaId(),hash).orElseGet(() ->
            new ImportacaoProdutoEntity(usuario.empresaId(),usuario.usuarioId(),hash,nomeArquivo(arquivo.getOriginalFilename())));
        if("CONFIRMADA".equals(registro.getEstado())) return resposta(registro);
        var indices=new LinkedHashMap<Integer,String>(); var ignoradas=new ArrayList<String>();
        for(int i=0;i<planilha.cabecalho().size();i++) {
            String titulo=planilha.cabecalho().get(i), campo=COLUNAS.get(ProdutoPlanilhaReader.normalizar(titulo));
            if(campo==null) { if(!titulo.isBlank()) ignoradas.add(titulo); }
            else { if(indices.containsValue(campo)) throw invalido("Coluna repetida: "+titulo+"."); indices.put(i,campo); }
        }
        if(!indices.values().containsAll(List.of("nome","precoVenda","unidadeMedida")))
            throw invalido("Colunas obrigatórias: Nome, Preço e Unidade.");
        var linhas=new ArrayList<EntradaLinha>();
        for(var linha:planilha.linhas()) {
            var campos=new LinkedHashMap<String,String>();
            indices.forEach((indice,campo)->campos.put(campo,indice<linha.valores().size()?linha.valores().get(indice):""));
            linhas.add(new EntradaLinha(linha.numero(),campos,linha.erros().stream().filter(erro -> indices.keySet().stream().anyMatch(indice -> erro.startsWith("Coluna "+(indice+1)+":"))).toList()));
        }
        var resultado=avaliar(linhas,usuario.empresaId());
        var dto=montar(registro,resultado,ignoradas);
        registro.previa(serializar(dto)); importacoes.saveAndFlush(registro);
        return resposta(registro);
    }
    @Transactional(readOnly=true)
    public ImportacaoProdutoDTO consultar(UUID id, Long empresaId) { return resposta(buscar(id,empresaId)); }
    @Transactional
    public ImportacaoProdutoDTO confirmar(UUID id, Long empresaId) {
        bloquearEmpresa(empresaId);
        var registro=importacoes.buscarComLock(id,empresaId).orElseThrow(ImportacaoProdutoService::naoEncontrado);
        if("CONFIRMADA".equals(registro.getEstado())) return resposta(registro);
        if(!"PREVIA".equals(registro.getEstado())) throw conflito("Esta prévia foi cancelada. Envie o arquivo novamente.");
        var anterior=resposta(registro);
        var candidatas=anterior.linhas().stream().filter(l->"VALIDA".equals(l.situacao()))
            .map(l->new EntradaLinha(l.linha(),l.campos(),List.of())).toList();
        if(candidatas.isEmpty()) throw conflito("Não há linhas válidas para importar.");
        var revisadas=avaliar(candidatas,empresaId);
        if(revisadas.stream().anyMatch(l->!"VALIDA".equals(l.situacao())))
            throw conflito("O catálogo mudou após a prévia. Reenvie o arquivo para revisar os vínculos e códigos antes de confirmar.");
        // All references are resolved in tenant-scoped bulk lookups again, never taken from the client.
        var entidades=new ArrayList<ProdutoEntity>();
        var contexto=contexto(candidatas,empresaId);
        for(var linha:revisadas) {
            var dto=linha.produto(); var produto=mapper.toEntity(dto);
            produto.setCategoria(contexto.categorias.get(chave(linha.campos().get("categoria"))));
            produto.setSubcategoria(contexto.subcategorias.get(chave(linha.campos().get("subcategoria"))));
            produto.setMarca(contexto.marcas.get(chave(linha.campos().get("marca"))));
            var fornecedor=contexto.fornecedores.get(chave(linha.campos().get("fornecedor")));
            produto.setFornecedorPrincipal(fornecedor==null || fornecedor.size()!=1?null:fornecedor.getFirst());
            entidades.add(produto);
        }
        produtoService.salvarImportacao(entidades,empresaId);
        registro.confirmar(entidades.size()); importacoes.saveAndFlush(registro);
        return resposta(registro);
    }
    @Transactional
    public ImportacaoProdutoDTO cancelar(UUID id, Long empresaId) {
        bloquearEmpresa(empresaId);
        var registro=importacoes.buscarComLock(id,empresaId).orElseThrow(ImportacaoProdutoService::naoEncontrado);
        if("CONFIRMADA".equals(registro.getEstado())) throw conflito("Importação já confirmada. Cancelar a prévia não remove produtos.");
        registro.cancelar(); return resposta(registro);
    }
    private record Contexto(Map<String,CategoriaProdutoEntity> categorias, Map<String,SubcategoriaProdutoEntity> subcategorias,
        Map<String,MarcaEntity> marcas, Map<String,List<FornecedorEntity>> fornecedores) {}
    private Contexto contexto(List<EntradaLinha> linhas, Long empresaId) {
        var nomes=linhas.stream().flatMap(l->List.of("categoria","subcategoria","marca","fornecedor").stream().map(c->chave(l.campos.get(c))))
            .filter(s->!s.isEmpty()).collect(Collectors.toSet());
        if(nomes.isEmpty()) return new Contexto(Map.of(),Map.of(),Map.of(),Map.of());
        var cat=categorias.buscarNomesImportacao(empresaId,nomes).stream().collect(Collectors.toMap(c->chave(c.getNome()),Function.identity()));
        var sub=subcategorias.buscarNomesImportacao(empresaId,nomes).stream().collect(Collectors.toMap(c->chave(c.getNome()),Function.identity()));
        var mar=marcas.buscarNomesImportacao(empresaId,nomes).stream().collect(Collectors.toMap(c->chave(c.getNome()),Function.identity()));
        var forn=new HashMap<String,List<FornecedorEntity>>();
        for(var f:fornecedores.buscarNomesImportacao(empresaId,nomes)) {
            for(String nome:new HashSet<>(Arrays.asList(chave(f.getRazaoSocial()),chave(f.getNomeFantasia()))))
                if(nomes.contains(nome)) forn.computeIfAbsent(nome,k->new ArrayList<>()).add(f);
        }
        return new Contexto(cat,sub,mar,forn);
    }
    private List<Linha> avaliar(List<EntradaLinha> entradas, Long empresaId) {
        var contexto=contexto(entradas,empresaId);
        var dtos=new HashMap<Integer,ProdutoRequestDTO>(); var erros=new HashMap<Integer,List<String>>();
        var codigos=new HashMap<String,Integer>(); var eans=new HashMap<String,Integer>(); var repetidas=new HashMap<Map<String,String>,Integer>();
        for(var entrada:entradas) {
            var msgs=new ArrayList<>(entrada.erros()); var campos=entrada.campos();
            if(campos.values().stream().allMatch(String::isBlank) && msgs.isEmpty()) continue;
            var dto=new ProdutoRequestDTO(); dto.setNome(campos.getOrDefault("nome",""));
            dto.setCodigoInterno(opcional(campos.get("codigoInterno"))==null?null:campos.get("codigoInterno").trim().toUpperCase(Locale.ROOT));
            dto.setCodigoBarras(opcional(campos.get("codigoBarras"))==null?null:campos.get("codigoBarras").replaceAll("\\s", ""));
            dto.setUnidadeMedida(campos.getOrDefault("unidadeMedida","").toUpperCase(Locale.ROOT));
            dto.setPrecoVenda(numero(campos.get("precoVenda"),2,"Preço",true,msgs));
            dto.setEstoqueMinimo(numero(campos.get("estoqueMinimo"),3,"Estoque mínimo",false,msgs));
            dto.setNcm(fiscal(campos.get("ncm"),8,"NCM",msgs)); dto.setCest(fiscal(campos.get("cest"),7,"CEST",msgs));
            dto.setAtivo(situacao(campos.get("ativo"),msgs));
            var cat=referencia(contexto.categorias,campos.get("categoria"),"Categoria",msgs);
            var sub=referencia(contexto.subcategorias,campos.get("subcategoria"),"Subcategoria",msgs);
            var marca=referencia(contexto.marcas,campos.get("marca"),"Marca",msgs);
            var forn=contexto.fornecedores.get(chave(campos.get("fornecedor")));
            if(opcional(campos.get("fornecedor"))!=null && (forn==null || forn.size()!=1)) msgs.add("Fornecedor principal não encontrado ou ambíguo nesta empresa.");
            if(sub!=null && (cat==null || !sub.getCategoria().getId().equals(cat.getId()))) msgs.add("Subcategoria não pertence à categoria informada.");
            dto.setCategoriaId(cat==null?null:cat.getId()); dto.setSubcategoriaId(sub==null?null:sub.getId()); dto.setMarcaId(marca==null?null:marca.getId());
            dto.setFornecedorId(forn!=null && forn.size()==1?forn.getFirst().getId():null);
            validator.validate(dto).stream().map(v->v.getMessage()).sorted().distinct().forEach(msgs::add);
            dtos.put(entrada.numero(),dto); erros.put(entrada.numero(),msgs);
            if(dto.getCodigoInterno()!=null) codigos.merge(dto.getCodigoInterno(),1,Integer::sum);
            if(dto.getCodigoBarras()!=null) eans.merge(dto.getCodigoBarras(),1,Integer::sum);
            repetidas.merge(campos,1,Integer::sum);
        }
        var existentes=produtos.buscarCodigosImportacao(empresaId,codigos.isEmpty()?Set.of(""):codigos.keySet(),eans.isEmpty()?Set.of(""):eans.keySet());
        var codigosExistentes=existentes.stream().map(ProdutoRepository.CodigosImportacao::getCodigoInterno).filter(Objects::nonNull).collect(Collectors.toSet());
        var eansExistentes=existentes.stream().map(ProdutoRepository.CodigosImportacao::getCodigoBarras).filter(Objects::nonNull).collect(Collectors.toSet());
        var resultado=new ArrayList<Linha>();
        for(var entrada:entradas) {
            var dto=dtos.get(entrada.numero());
            if(dto==null) { resultado.add(new Linha(entrada.numero(),"IGNORADA","Linha sem campos importáveis.",entrada.campos(),null)); continue; }
            var msgs=erros.get(entrada.numero());
            if(!msgs.isEmpty()) { resultado.add(new Linha(entrada.numero(),"INVALIDA",String.join(" ",new LinkedHashSet<>(msgs)),entrada.campos(),null)); continue; }
            if((dto.getCodigoInterno()!=null && (codigos.get(dto.getCodigoInterno())>1 || codigosExistentes.contains(dto.getCodigoInterno())))
                || (dto.getCodigoBarras()!=null && (eans.get(dto.getCodigoBarras())>1 || eansExistentes.contains(dto.getCodigoBarras())))
                || repetidas.get(entrada.campos())>1)
                resultado.add(new Linha(entrada.numero(),"DUPLICADA","Código, EAN ou linha repetida no arquivo, ou código/EAN já cadastrado nesta empresa. Produto existente não será atualizado.",entrada.campos(),null));
            else resultado.add(new Linha(entrada.numero(),"VALIDA","Pronta para criar produto, sem saldo inicial.",entrada.campos(),dto));
        }
        return resultado;
    }
    private static <T> T referencia(Map<String,T> mapa,String nome,String tipo,List<String> erros) {
        if(opcional(nome)==null) return null; var item=mapa.get(chave(nome));
        if(item==null) erros.add(tipo+" não encontrada nesta empresa."); return item;
    }
    private static BigDecimal numero(String texto,int casas,String nome,boolean obrigatorio,List<String> erros) {
        if(opcional(texto)==null) { if(obrigatorio) erros.add(nome+" obrigatório."); return obrigatorio?null:BigDecimal.ZERO; }
        String normal=texto.trim().replace("R$", "").replace("\u00a0", "").replace(" ", "");
        if(normal.contains(",")) {
            if(!normal.matches("-?(?:[0-9]+|[0-9]{1,3}(?:\\.[0-9]{3})+),[0-9]{1,"+casas+"}")) { erros.add(nome+" inválido."); return null; }
            normal=normal.replace(".","").replace(',','.');
        }
        if(!normal.matches("-?[0-9]+(?:\\.[0-9]{1,"+casas+"})?")) { erros.add(nome+" inválido."); return null; }
        try { return new BigDecimal(normal); } catch(NumberFormatException e) { erros.add(nome+" inválido."); return null; }
    }
    private static String fiscal(String texto,int tamanho,String nome,List<String> erros) {
        if(opcional(texto)==null) return null;
        String valor=texto.replace(".","").replace(" ","");
        if(!valor.matches("[0-9]{"+tamanho+"}")) erros.add(nome+" deve conter "+tamanho+" dígitos, preservando zeros iniciais."); return valor;
    }
    private static boolean situacao(String texto,List<String> erros) {
        if(opcional(texto)==null) return true;
        String valor=ProdutoPlanilhaReader.normalizar(texto);
        if(Set.of("ativo","ativa","sim","true","1").contains(valor)) return true;
        if(Set.of("inativo","inativa","nao","false","0").contains(valor)) return false;
        erros.add("Status inválido. Use Ativo ou Inativo."); return true;
    }
    private ImportacaoProdutoDTO montar(ImportacaoProdutoEntity registro,List<Linha> linhas,List<String> colunas) {
        return new ImportacaoProdutoDTO(registro.getId(),registro.getNomeArquivo(),"PREVIA",contar(linhas,"VALIDA"),contar(linhas,"INVALIDA"),
            contar(linhas,"DUPLICADA"),contar(linhas,"IGNORADA"),0,colunas,linhas);
    }
    private static int contar(List<Linha> linhas,String situacao) { return (int)linhas.stream().filter(l->situacao.equals(l.situacao())).count(); }
    private ImportacaoProdutoDTO resposta(ImportacaoProdutoEntity registro) {
        try { var dto=json.readValue(registro.getPreviaJson(),ImportacaoProdutoDTO.class);
            return new ImportacaoProdutoDTO(registro.getId(),registro.getNomeArquivo(),registro.getEstado(),dto.validas(),dto.invalidas(),dto.duplicadas(),dto.ignoradas(),registro.getImportados(),dto.colunasIgnoradas(),dto.linhas());
        } catch(Exception e) { throw new IllegalStateException("Prévia persistida inválida.",e); }
    }
    private String serializar(ImportacaoProdutoDTO dto) { try { return json.writeValueAsString(dto); } catch(Exception e) { throw new IllegalStateException(e); } }
    private ImportacaoProdutoEntity buscar(UUID id,Long empresaId) { return importacoes.findByIdAndEmpresaId(id,empresaId).orElseThrow(ImportacaoProdutoService::naoEncontrado); }
    private void bloquearEmpresa(Long id) { empresas.buscarParaImportacao(id).orElseThrow(ImportacaoProdutoService::naoEncontrado); }
    private static String opcional(String s) { return s==null || s.isBlank()?null:s.trim(); }
    private static String chave(String s) { return s==null?"":s.trim().toLowerCase(Locale.ROOT); }
    private static String nomeArquivo(String s) { String nome=s==null?"produtos":s.replace('\\','/'); nome=nome.substring(nome.lastIndexOf('/')+1); return nome.substring(0,Math.min(255,nome.length())); }
    private static ResponseStatusException naoEncontrado() { return new ResponseStatusException(HttpStatus.NOT_FOUND,"Importação não encontrada nesta empresa."); }
    private static ResponseStatusException conflito(String s) { return new ResponseStatusException(HttpStatus.CONFLICT,s); }
}
