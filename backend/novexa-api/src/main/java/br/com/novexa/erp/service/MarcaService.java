package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.MarcaEntity;
import br.com.novexa.erp.repository.*;
import br.com.novexa.erp.util.Paginacao;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.Locale;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class MarcaService {
    private final MarcaRepository marcas;
    private final EmpresaRepository empresas;
    private final ProdutoRepository produtos;

    public MarcaService(MarcaRepository marcas, EmpresaRepository empresas, ProdutoRepository produtos) {
        this.marcas = marcas; this.empresas = empresas; this.produtos = produtos;
    }
    public PaginaResponseDTO<MarcaResponseDTO> listar(Long empresaId, String termo, Boolean ativo,
                                                     int page, int size, String sort) {
        String texto = termo == null ? "" : termo.trim().toLowerCase(Locale.ROOT);
        String busca = "%" + texto.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        return PaginaResponseDTO.de(marcas.listar(empresaId, busca, ativo,
            Paginacao.criar(page, size, sort, Set.of("id", "nome", "ativo"), Sort.Direction.ASC)), MarcaResponseDTO::de);
    }
    public MarcaResponseDTO consultar(Long id, Long empresaId) { return MarcaResponseDTO.de(marca(id, empresaId)); }

    @Transactional
    public MarcaResponseDTO salvar(Long id, Long empresaId, MarcaRequestDTO pedido) {
        var existente = id == null ? null : marca(id, empresaId);
        String nome = pedido.nome().trim();
        if (marcas.existsByEmpresaIdAndNomeIgnoreCaseAndIdNot(empresaId, nome, id == null ? -1L : id))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe uma marca com este nome nesta empresa.");
        if (existente == null) existente = new MarcaEntity(empresas.findById(empresaId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa não encontrada.")), nome, pedido.ativo() == null || pedido.ativo());
        else existente.atualizar(nome, pedido.ativo() == null ? existente.isAtivo() : pedido.ativo());
        return MarcaResponseDTO.de(marcas.saveAndFlush(existente));
    }

    @Transactional
    public void excluir(Long id, Long empresaId) {
        var existente = marca(id, empresaId);
        if (produtos.existsByMarcaIdAndEmpresaId(id, empresaId))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Marca possui produtos vinculados. Inative a marca para preservar os vínculos.");
        marcas.delete(existente); marcas.flush();
    }
    private MarcaEntity marca(Long id, Long empresaId) {
        return marcas.findByIdAndEmpresaId(id, empresaId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Marca não encontrada."));
    }
}
