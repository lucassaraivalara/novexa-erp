package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.ClienteRequestDTO;
import br.com.novexa.erp.dto.ClienteResponseDTO;
import br.com.novexa.erp.entity.ClienteEntity;
import br.com.novexa.erp.mapper.ClienteMapper;
import br.com.novexa.erp.service.ClienteService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
            @Valid @RequestBody ClienteRequestDTO request) {

        ClienteEntity cliente = clienteMapper.toEntity(request);
        ClienteEntity clienteSalvo = clienteService.salvar(cliente, request.getEmpresaId());

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(clienteMapper.toResponse(clienteSalvo));
    }

    @GetMapping
    public ResponseEntity<List<ClienteResponseDTO>> listar(
            @RequestParam Long empresaId) {

        List<ClienteResponseDTO> clientes = clienteService.listar(empresaId)
                .stream()
                .map(clienteMapper::toResponse)
                .toList();

        return ResponseEntity.ok(clientes);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClienteResponseDTO> buscarPorId(
            @PathVariable Long id,
            @RequestParam Long empresaId) {

        ClienteEntity cliente = clienteService.buscarPorId(id, empresaId);
        return ResponseEntity.ok(clienteMapper.toResponse(cliente));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClienteResponseDTO> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody ClienteRequestDTO request) {

        ClienteEntity dadosNovos = clienteMapper.toEntity(request);
        ClienteEntity clienteAtualizado = clienteService.atualizar(
                id,
                dadosNovos,
                request.getEmpresaId()
        );

        return ResponseEntity.ok(clienteMapper.toResponse(clienteAtualizado));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> inativar(
            @PathVariable Long id,
            @RequestParam Long empresaId) {

        clienteService.inativar(id, empresaId);
        return ResponseEntity.noContent().build();
    }
}
