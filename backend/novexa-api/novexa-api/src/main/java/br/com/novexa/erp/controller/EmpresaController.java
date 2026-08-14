package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.service.EmpresaService;
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
    public EmpresaEntity salvar(@RequestBody EmpresaEntity empresa) {

        // Envia o objeto recebido para o Service.
        return empresaService.salvar(empresa);
    }
    // GET /empresas
    @GetMapping
    public List<EmpresaEntity> listar() {
        return empresaService.listar();
    }

    @GetMapping("/{id}")
    public EmpresaEntity buscarPorId(@PathVariable Long id) {

        // Envia o ID recebido na URL para o Service
        return empresaService.buscarPorId(id);
    }

    @PutMapping("/{id}")
    public EmpresaEntity atualizarPorId(
            @PathVariable Long id,
            @RequestBody EmpresaEntity empresa) {

        return empresaService.atualizarPorId(id, empresa);
    }

    @DeleteMapping("/{id}")
    public void deletarPorId(@PathVariable Long id) {
        empresaService.deletarPorId(id);
    }
}