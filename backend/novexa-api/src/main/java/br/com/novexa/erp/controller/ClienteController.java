package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.ClienteRequestDTO;
import br.com.novexa.erp.dto.ClienteResponseDTO;
import br.com.novexa.erp.dto.PaginaResponseDTO;
import br.com.novexa.erp.entity.ClienteEntity;
import br.com.novexa.erp.mapper.ClienteMapper;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.service.ClienteService;
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

import java.util.List;

@org.springframework.transaction.annotation.Transactional
@RestController
@RequestMapping("/clientes")
public class ClienteController {

    private final ClienteService clienteService;
    private final ClienteMapper clienteMapper;

    public ClienteController(
            ClienteService clienteService,
            ClienteMapper clienteMapper) {

        this.clienteService = clienteService;
        this.clienteMapper = clienteMapper;
    }

    @PostMapping
    public ResponseEntity<ClienteResponseDTO> salvar(
            @Valid @RequestBody ClienteRequestDTO request,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        ClienteEntity cliente = clienteMapper.toEntity(request);
        ClienteEntity clienteSalvo = clienteService.salvar(cliente, usuario.empresaId());

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(clienteMapper.toResponse(clienteSalvo));
    }

    @GetMapping
    public PaginaResponseDTO<ClienteResponseDTO> listar(
            @RequestParam(required = false) String situacao,
            @RequestParam(required = false) String busca,
            @RequestParam(required = false) String campoBusca,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "nome,asc") String sort,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        return clienteService.listarPaginado(
                usuario.empresaId(),
                situacao,
                busca,
                campoBusca,
                sort,
                page,
                size
        );
    }

    @GetMapping("/opcoes")
    public List<ClienteResponseDTO> opcoes(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return clienteService.listar(usuario.empresaId()).stream().map(clienteMapper::toResponse).toList();
    }

    @GetMapping("/buscar")
    public List<ClienteResponseDTO> buscar(@RequestParam(defaultValue = "") String termo,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return clienteService.buscarPorTermo(usuario.empresaId(), termo).stream()
                .map(clienteMapper::toResponse).toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClienteResponseDTO> buscarPorId(
            @PathVariable Long id,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        ClienteEntity cliente = clienteService.buscarPorId(id, usuario.empresaId());
        return ResponseEntity.ok(clienteMapper.toResponse(cliente));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClienteResponseDTO> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody ClienteRequestDTO request,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        ClienteEntity dadosNovos = clienteMapper.toEntity(request);
        ClienteEntity clienteAtualizado = clienteService.atualizar(
                id,
                dadosNovos,
                usuario.empresaId()
        );

        return ResponseEntity.ok(clienteMapper.toResponse(clienteAtualizado));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> inativar(
            @PathVariable Long id,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {

        clienteService.inativar(id, usuario.empresaId());
        return ResponseEntity.noContent().build();
    }
}
