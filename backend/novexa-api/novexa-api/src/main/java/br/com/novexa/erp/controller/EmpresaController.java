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

            // Pega o ID que veio na URL.
            // Em /empresas/4, o valor de id será 4.
            @PathVariable Long id,

            // Recebe o JSON enviado na requisição
            // e o transforma em um objeto EmpresaRequestDTO.
            @RequestBody EmpresaRequestDTO empresaDTO) {

        // Cria uma EmpresaEntity, que é o objeto usado
        // pelo service e pelo banco de dados.
        EmpresaEntity empresa = new EmpresaEntity();

        // Copia cada dado recebido no DTO para a entidade.
        empresa.setRazaoSocial(empresaDTO.getRazaoSocial());
        empresa.setNomeFantasia(empresaDTO.getNomeFantasia());
        empresa.setCnpj(empresaDTO.getCnpj());
        empresa.setInscricaoEstadual(empresaDTO.getInscricaoEstadual());
        empresa.setEmail(empresaDTO.getEmail());
        empresa.setTelefone(empresaDTO.getTelefone());
        empresa.setEndereco(empresaDTO.getEndereco());
        empresa.setAtivo(empresaDTO.getAtivo());

        // Envia o ID e os novos dados para o service.
        // O service encontra a empresa existente no banco,
        // atualiza os campos e salva as alterações.
        EmpresaEntity empresaAtualizada =
                empresaService.atualizarPorId(id, empresa);

        // Devolve a empresa atualizada como JSON
        // com o status HTTP 200 OK.
        return ResponseEntity.ok(empresaAtualizada);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletarPorId(@PathVariable Long id) {
        empresaService.deletarPorId(id);

        return ResponseEntity.noContent().build();
    }
}
