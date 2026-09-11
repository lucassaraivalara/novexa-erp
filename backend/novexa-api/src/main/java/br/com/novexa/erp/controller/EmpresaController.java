package br.com.novexa.erp.controller;


import jakarta.validation.Valid;
import br.com.novexa.erp.dto.EmpresaRequestDTO;
import br.com.novexa.erp.dto.EmpresaResponseDTO;
import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.mapper.EmpresaMapper;
import br.com.novexa.erp.service.EmpresaService;
import br.com.novexa.erp.security.UsuarioAutenticado;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Controller responsável pelas requisições relacionadas às empresas.
 *
 * O Controller é a porta de entrada da API.
 * Ele recebe as requisições HTTP e encaminha as informações
 * para a camada de Service.
 */
@RestController
@org.springframework.transaction.annotation.Transactional
@RequestMapping("/empresas")
public class EmpresaController {

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<String> tratarConflito() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body("Não foi possível gravar: documento ou inscrição duplicada, ou empresa vinculada a outros registros.");
    }

    /*
     * Service responsável pelas regras de negócio
     * relacionadas à empresa.
     */
    private final EmpresaService empresaService;

    /*
     * Mapper responsável por converter os objetos:
     *
     * EmpresaRequestDTO  → EmpresaEntity
     * EmpresaEntity      → EmpresaResponseDTO
     */
    private final EmpresaMapper empresaMapper;

    /*
     * Construtor do Controller.
     *
     * O Spring entrega automaticamente o Service
     * e o Mapper através da injeção de dependência.
     */
    public EmpresaController(
            EmpresaService empresaService,
            EmpresaMapper empresaMapper) {

        this.empresaService = empresaService;
        this.empresaMapper = empresaMapper;
    }

    /*
     * =========================================================
     * CADASTRAR EMPRESA
     * =========================================================
     *
     * POST /empresas
     */
    @PostMapping
    public ResponseEntity<EmpresaResponseDTO> salvar(
          @Valid @RequestBody EmpresaRequestDTO empresaDTO) {

        /*
         * Converte o DTO recebido pela API
         * para uma EmpresaEntity.
         *
         * RequestDTO → Entity
         */
        EmpresaEntity empresa =
                empresaMapper.paraEntity(empresaDTO);

        /*
         * Envia a Entity para o Service realizar
         * o processo de salvamento.
         */
        EmpresaEntity empresaSalva =
                empresaService.salvar(empresa);

        /*
         * Converte a Entity salva para ResponseDTO.
         *
         * Entity → ResponseDTO
         */
        EmpresaResponseDTO responseDTO =
                empresaMapper.paraDetalheDTO(empresaSalva);

        /*
         * Retorna a empresa criada com HTTP 201 CREATED.
         */
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(responseDTO);
    }

    /*
     * =========================================================
     * LISTAR EMPRESAS
     * =========================================================
     *
     * GET /empresas
     */
    @GetMapping
    public ResponseEntity<List<EmpresaResponseDTO>> listar(
            @AuthenticationPrincipal UsuarioAutenticado autenticado) {

        /*
         * Busca somente a empresa do usuário autenticado através do Service.
         */
        List<EmpresaEntity> empresas =
                empresaService.listar(autenticado.empresaId());

        /*
         * Converte cada EmpresaEntity para
         * EmpresaResponseDTO.
         *
         * Entity → ResponseDTO
         */
        List<EmpresaResponseDTO> empresasResponse =
                empresas.stream()
                        .map(empresaMapper::paraResponseDTO)
                        .collect(Collectors.toList());

        /*
         * Retorna a lista com HTTP 200 OK.
         */
        return ResponseEntity.ok(empresasResponse);
    }

    /*
     * =========================================================
     * BUSCAR EMPRESA POR ID
     * =========================================================
     *
     * GET /empresas/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<EmpresaResponseDTO> buscarPorId(
            @PathVariable Long id,
            @AuthenticationPrincipal UsuarioAutenticado autenticado) {

        /*
         * Busca a empresa no Service.
         */
        EmpresaEntity empresa =
                empresaService.buscarPorId(id, autenticado.empresaId());

        /*
         * Converte a Entity encontrada
         * para ResponseDTO.
         */
        EmpresaResponseDTO responseDTO =
                empresaMapper.paraDetalheDTO(empresa);

        /*
         * Retorna a empresa encontrada.
         */
        return ResponseEntity.ok(responseDTO);
    }

    /*
     * =========================================================
     * ATUALIZAR EMPRESA
     * =========================================================
     *
     * PUT /empresas/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<EmpresaResponseDTO> atualizarPorId(

            /*
             * Pega o ID que veio na URL.
             *
             * Exemplo:
             * /empresas/4
             *
             * id = 4
             */
            @PathVariable Long id,

            /*
             * Recebe o JSON enviado na requisição
             * e transforma em EmpresaRequestDTO.
             */
            @Valid @RequestBody EmpresaRequestDTO empresaDTO,

            /*
             * Usuário autenticado via JWT.
             */
            @AuthenticationPrincipal UsuarioAutenticado autenticado) {

        /*
         * Converte o RequestDTO para Entity.
         */
        EmpresaEntity empresa =
                empresaMapper.paraEntity(empresaDTO);

        /*
         * Envia o ID, a Entity e o empresaId do usuário
         * para o Service.
         */
        EmpresaEntity empresaAtualizada =
                empresaService.atualizarPorId(id, empresa, autenticado.empresaId());

        /*
         * Converte a Entity atualizada
         * para ResponseDTO.
         */
        EmpresaResponseDTO responseDTO =
                empresaMapper.paraDetalheDTO(empresaAtualizada);

        /*
         * Retorna a empresa atualizada.
         */
        return ResponseEntity.ok(responseDTO);
    }

    /*
     * =========================================================
     * EXCLUIR EMPRESA
     * =========================================================
     *
     * DELETE /empresas/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletarPorId(
            @PathVariable Long id,
            @AuthenticationPrincipal UsuarioAutenticado autenticado) {

        /*
         * Solicita ao Service a exclusão
         * da empresa pelo ID.
         */
        empresaService.deletarPorId(id, autenticado.empresaId());

        /*
         * HTTP 204 NO CONTENT.
         *
         * A exclusão foi realizada com sucesso
         * e não há conteúdo para retornar.
         */
        return ResponseEntity.noContent().build();
    }
}
