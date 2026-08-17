package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.EmpresaRequestDTO;
import br.com.novexa.erp.dto.EmpresaResponseDTO;
import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.mapper.EmpresaMapper;
import br.com.novexa.erp.service.EmpresaService;
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
@RequestMapping("/empresas")
public class EmpresaController {

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
            @RequestBody EmpresaRequestDTO empresaDTO) {

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
                empresaMapper.paraResponseDTO(empresaSalva);

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
    public ResponseEntity<List<EmpresaResponseDTO>> listar() {

        /*
         * Busca todas as empresas através do Service.
         */
        List<EmpresaEntity> empresas =
                empresaService.listar();

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
            @PathVariable Long id) {

        /*
         * Busca a empresa no Service.
         */
        EmpresaEntity empresa =
                empresaService.buscarPorId(id);

        /*
         * Converte a Entity encontrada
         * para ResponseDTO.
         */
        EmpresaResponseDTO responseDTO =
                empresaMapper.paraResponseDTO(empresa);

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
            @RequestBody EmpresaRequestDTO empresaDTO) {

        /*
         * Converte o RequestDTO para Entity.
         */
        EmpresaEntity empresa =
                empresaMapper.paraEntity(empresaDTO);

        /*
         * Envia o ID e a Entity para o Service.
         */
        EmpresaEntity empresaAtualizada =
                empresaService.atualizarPorId(id, empresa);

        /*
         * Converte a Entity atualizada
         * para ResponseDTO.
         */
        EmpresaResponseDTO responseDTO =
                empresaMapper.paraResponseDTO(empresaAtualizada);

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
            @PathVariable Long id) {

        /*
         * Solicita ao Service a exclusão
         * da empresa pelo ID.
         */
        empresaService.deletarPorId(id);

        /*
         * HTTP 204 NO CONTENT.
         *
         * A exclusão foi realizada com sucesso
         * e não há conteúdo para retornar.
         */
        return ResponseEntity.noContent().build();
    }
}