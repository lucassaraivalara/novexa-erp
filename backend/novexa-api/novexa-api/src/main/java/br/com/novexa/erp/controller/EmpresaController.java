package br.com.novexa.erp.controller;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.service.EmpresaService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}