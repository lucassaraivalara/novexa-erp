package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.ProdutoRequestDTO;
import br.com.novexa.erp.dto.ProdutoResponseDTO;
import br.com.novexa.erp.entity.ProdutoEntity;
import br.com.novexa.erp.mapper.ProdutoMapper;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.ProdutoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.MediaType;

import java.util.List;

@RestController
@RequestMapping("/produtos")
public class ProdutoController {
    @GetMapping("/composicao/capacidade")
    public java.util.Map<String,Boolean> capacidadeComposicao() { return java.util.Map.of("habilitado",true); }
    @org.springframework.beans.factory.annotation.Autowired private br.com.novexa.erp.service.ComposicaoProdutoService composicoes;
    @GetMapping("/{id}/composicoes")
    public java.util.List<br.com.novexa.erp.service.ComposicaoProdutoService.Linha> composicoes(@PathVariable Long id,@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return composicoes.historico(id,usuario.empresaId());
    }

    private final ProdutoService produtoService;
    private final ProdutoMapper produtoMapper;

    public ProdutoController(
            ProdutoService produtoService,
            ProdutoMapper produtoMapper) {

        this.produtoService = produtoService;
        this.produtoMapper = produtoMapper;
    }

    @PostMapping
    public ResponseEntity<ProdutoResponseDTO> salvar(
            @Valid @RequestBody ProdutoRequestDTO request,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        request.setUsuarioComposicaoId(usuario.usuarioId());
        ProdutoEntity produto = produtoMapper.toEntity(request);
        ProdutoEntity produtoSalvo = produtoService.salvar(produto, usuario.empresaId(), request.getFornecedorId(), request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(resposta(produtoSalvo));
    }

    @GetMapping
    public br.com.novexa.erp.dto.PaginaResponseDTO<ProdutoResponseDTO> listar(
            @RequestParam(required = false) String busca,
            @RequestParam(required = false) String campoBusca,
            @RequestParam(required = false) String situacao,
            @RequestParam(required = false) String situacaoEstoque,
            @RequestParam(required = false) Long categoriaId,
            @RequestParam(required = false) Long subcategoriaId,
            @RequestParam(required = false) Long marcaId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "nome,asc") String sort,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        var pagina=produtoService.listarPagina(usuario.empresaId(),
                busca, campoBusca, situacao, situacaoEstoque, page, size, sort, categoriaId, subcategoriaId, marcaId);
        var consulta=composicoes.consultas(usuario.empresaId(),pagina.getContent().stream().filter(ProdutoEntity::isComposto).map(ProdutoEntity::getId).toList());
        var vinculos=produtoService.vinculosFornecedoresPorProdutos(pagina.getContent().stream().map(ProdutoEntity::getId).toList(),usuario.empresaId());
        return br.com.novexa.erp.dto.PaginaResponseDTO.de(pagina,p->resposta(p,consulta,vinculos));
    }

    @GetMapping("/buscar")
    public ResponseEntity<List<ProdutoResponseDTO>> buscarPorTermo(
            @AuthenticationPrincipal UsuarioAutenticado usuario,
            @RequestParam String termo) {

        var encontrados=produtoService.buscarPorTermo(usuario.empresaId(),termo);
        var consulta=composicoes.consultas(usuario.empresaId(),encontrados.stream().filter(ProdutoEntity::isComposto).map(ProdutoEntity::getId).toList());
        var vinculos=produtoService.vinculosFornecedoresPorProdutos(encontrados.stream().map(ProdutoEntity::getId).toList(),usuario.empresaId());
        var produtos=encontrados.stream().map(p->resposta(p,consulta,vinculos)).toList();

        return ResponseEntity.ok(produtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProdutoResponseDTO> buscarPorId(
            @PathVariable Long id,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        ProdutoEntity produto = produtoService.buscarPorId(id, usuario.empresaId());
        return ResponseEntity.ok(resposta(produto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProdutoResponseDTO> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody ProdutoRequestDTO request,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        request.setUsuarioComposicaoId(usuario.usuarioId());
        ProdutoEntity dadosNovos = produtoMapper.toEntity(request);
        ProdutoEntity produtoAtualizado = produtoService.atualizar(
                id,
                dadosNovos,
                usuario.empresaId(), request.getFornecedorId(), request.isFornecedorInformado(), request
        );

        return ResponseEntity.ok(resposta(produtoAtualizado));
    }

    @PostMapping(value = "/{id}/imagem", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProdutoResponseDTO> salvarImagem(
            @PathVariable Long id,
            @RequestPart("arquivo") MultipartFile arquivo,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        ProdutoEntity produto = produtoService.salvarImagem(id, arquivo, usuario);
        return ResponseEntity.ok(resposta(produto));
    }

    @DeleteMapping("/{id}/imagem")
    public ResponseEntity<ProdutoResponseDTO> removerImagem(
            @PathVariable Long id,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        ProdutoEntity produto = produtoService.removerImagem(id, usuario);
        return ResponseEntity.ok(resposta(produto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> inativar(
            @PathVariable Long id,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        produtoService.inativar(id, usuario.empresaId());
        return ResponseEntity.noContent().build();
    }

    private ProdutoResponseDTO resposta(ProdutoEntity p) {
        var consulta=composicoes.consultas(p.getEmpresa().getId(),p.isComposto()?List.of(p.getId()):List.of());
        var vinculos=produtoService.vinculosFornecedoresPorProdutos(List.of(p.getId()),p.getEmpresa().getId());
        return resposta(p,consulta,vinculos);
    }
    private ProdutoResponseDTO resposta(ProdutoEntity p,java.util.Map<Long,List<ProdutoResponseDTO.Componente>> consulta) {
        return resposta(p,consulta,java.util.Map.of());
    }
    private ProdutoResponseDTO resposta(ProdutoEntity p,java.util.Map<Long,List<ProdutoResponseDTO.Componente>> consulta,
                                        java.util.Map<Long,List<br.com.novexa.erp.entity.ProdutoFornecedorEntity>> vinculos) {
        var dto=produtoMapper.toResponse(p);dto.setComponentes(consulta.getOrDefault(p.getId(),List.of()));
        dto.setFornecedoresAdicionais(vinculos.getOrDefault(p.getId(),List.of()).stream().map(this::vinculoResposta).toList());
        return dto;
    }
    private ProdutoResponseDTO.FornecedorVinculo vinculoResposta(br.com.novexa.erp.entity.ProdutoFornecedorEntity v) {
        return new ProdutoResponseDTO.FornecedorVinculo(
                br.com.novexa.erp.dto.FornecedorProdutoResponseDTO.de(v.getFornecedor()), v.getCodigoReferencia());
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<String> conflitoFornecedor(org.springframework.dao.DataIntegrityViolationException erro) {
        for (Throwable causa = erro; causa != null; causa = causa.getCause()) {
            if (causa instanceof org.hibernate.exception.ConstraintViolationException restricao
                    && "uk_produto_empresa_codigo_interno".equals(restricao.getConstraintName())) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body("Já existe um produto com este código interno na empresa informada.");
            }
            if (causa instanceof org.hibernate.exception.ConstraintViolationException restricao
                    && java.util.Set.of("fk_produto_fornecedor_empresa", "fk_produto_fornecedor_vinc_empresa", "fk_produto_fornecedor_vinc_produto", "fk_produto_fornecedor_vinc_fornecedor", "fk_produto_categoria_empresa", "fk_produto_subcategoria_empresa", "fk_produto_marca_empresa", "ck_produto_subcategoria_categoria").contains(restricao.getConstraintName())) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body("Cadastro indisponível ou vínculo inválido. Atualize a consulta e tente novamente.");
            }
        }
        throw erro;
    }
}
