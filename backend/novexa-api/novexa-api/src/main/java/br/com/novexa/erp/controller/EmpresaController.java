package br.com.novexa.erp.controller;

import br.com.novexa.erp.dto.EmpresaRequestDTO;
import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.service.EmpresaService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/empresas")
public class EmpresaController {

    private final EmpresaService empresaService;

    // O Spring entrega o EmpresaService para o Controller
    // através do construtor.
    public EmpresaController(EmpresaService empresaService) {
        this.empresaService = empresaService;
    }

    // Cadastra uma nova empresa
    //
    // POST /empresas
    //
    // @RequestBody pega o JSON enviado na requisição
    // e transforma em um objeto EmpresaEntity.
    @PostMapping
    public ResponseEntity<EmpresaEntity> salvar(
            @RequestBody EmpresaRequestDTO empresaDTO) {

        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setRazaoSocial(empresaDTO.getRazaoSocial());
        empresa.setNomeFantasia(empresaDTO.getNomeFantasia());
        empresa.setCnpj(empresaDTO.getCnpj());
        empresa.setInscricaoEstadual(empresaDTO.getInscricaoEstadual());
        empresa.setEmail(empresaDTO.getEmail());
        empresa.setTelefone(empresaDTO.getTelefone());
        empresa.setEndereco(empresaDTO.getEndereco());
        empresa.setAtivo(empresaDTO.getAtivo());

        EmpresaEntity empresaSalva = empresaService.salvar(empresa);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(empresaSalva);
    }
    // GET /empresas
    @GetMapping
    public ResponseEntity<List<EmpresaEntity>> listar() {
        List<EmpresaEntity> empresas = empresaService.listar();

        return ResponseEntity.ok(empresas);
    }

    @GetMapping("/{id}")
    public ResponseEntity<EmpresaEntity> buscarPorId(
            @PathVariable Long id) {

        EmpresaEntity empresa = empresaService.buscarPorId(id);

        return ResponseEntity.ok(empresa);
    }

    @PutMapping("/{id}")
    public ResponseEntity<EmpresaEntity> atualizarPorId(
            @PathVariable Long id,
            @RequestBody EmpresaEntity empresa) {

        EmpresaEntity empresaAtualizada = empresaService.atualizarPorId(id, empresa);

        return ResponseEntity.ok(empresaAtualizada);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletarPorId(@PathVariable Long id) {
        empresaService.deletarPorId(id);

        return ResponseEntity.noContent().build();
    }
}
