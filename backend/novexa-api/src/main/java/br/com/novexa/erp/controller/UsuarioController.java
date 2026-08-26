package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.UsuarioRequestDTO;
import br.com.novexa.erp.dto.UsuarioResponseDTO;
import br.com.novexa.erp.entity.UsuarioEntity;
import br.com.novexa.erp.mapper.UsuarioMapper;
import br.com.novexa.erp.service.UsuarioService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/usuarios")
public class UsuarioController {

    private final UsuarioService usuarioService;
    private final UsuarioMapper usuarioMapper;

    // =========================================================
    // CONSTRUTOR
    // =========================================================

    // O Spring fornece automaticamente o UsuarioService
    // e o UsuarioMapper.
    public UsuarioController(
            UsuarioService usuarioService,
            UsuarioMapper usuarioMapper) {

        this.usuarioService = usuarioService;
        this.usuarioMapper = usuarioMapper;
    }

    // =========================================================
    // POST - CADASTRAR
    // =========================================================

    // POST /usuarios
    @PostMapping
    public UsuarioResponseDTO salvar(
            @RequestBody UsuarioRequestDTO request) {

        // Converte o JSON recebido para UsuarioEntity.
        UsuarioEntity usuario = usuarioMapper.toEntity(request);

        // Envia a Entity para o Service.
        UsuarioEntity usuarioSalvo =
                usuarioService.salvar(usuario);

        // Converte a Entity salva para ResponseDTO.
        return usuarioMapper.toResponse(usuarioSalvo);
    }

    // =========================================================
    // GET - LISTAR
    // =========================================================

    // GET /usuarios
    @GetMapping
    public List<UsuarioResponseDTO> listar() {

        // Busca os usuários no Service.
        List<UsuarioEntity> usuarios =
                usuarioService.listar();

        // Converte cada Entity para ResponseDTO.
        return usuarios.stream()
                .map(usuarioMapper::toResponse)
                .toList();
    }

    // =========================================================
    // GET - BUSCAR POR ID
    // =========================================================

    // GET /usuarios/{id}
    @GetMapping("/{id}")
    public UsuarioResponseDTO buscarPorId(
            @PathVariable Long id) {

        // Busca o usuário pelo ID.
        UsuarioEntity usuario =
                usuarioService.buscarPorId(id);

        // Converte a Entity para ResponseDTO.
        return usuarioMapper.toResponse(usuario);
    }
// =========================================================
// PUT - ATUALIZAR
// =========================================================

    // PUT /usuarios/{id}
    @PutMapping("/{id}")
    public UsuarioResponseDTO atualizar(
            @PathVariable Long id,
            @RequestBody UsuarioRequestDTO request) {

        // Primeiro converte os dados recebidos no JSON
        // para uma UsuarioEntity.
        UsuarioEntity dadosNovos =
                usuarioMapper.toEntity(request);

        // Envia o ID e os novos dados para o Service.
        UsuarioEntity usuarioAtualizado =
                usuarioService.atualizar(id, dadosNovos);

        // Converte a Entity atualizada para ResponseDTO.
        return usuarioMapper.toResponse(usuarioAtualizado);
    }

// =========================================================
// DELETE - EXCLUIR
// =========================================================

    // DELETE /usuarios/{id}
    @DeleteMapping("/{id}")
    public void excluir(@PathVariable Long id) {

        // Envia o ID recebido na URL para o Service.
        usuarioService.excluir(id);
    }
}