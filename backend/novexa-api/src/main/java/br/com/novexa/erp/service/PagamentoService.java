package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.PagamentoResponseDTO;
import br.com.novexa.erp.entity.PagamentoEntity;
import br.com.novexa.erp.entity.UsuarioEntity;
import br.com.novexa.erp.entity.VendaEntity;
import br.com.novexa.erp.repository.PagamentoRepository;
import br.com.novexa.erp.repository.VendaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class PagamentoService {
    private final PagamentoRepository pagamentos;
    private final VendaRepository vendas;

    public PagamentoService(PagamentoRepository pagamentos, VendaRepository vendas) {
        this.pagamentos = pagamentos;
        this.vendas = vendas;
    }

    // Uso interno do faturamento, sob o lock da Venda e na mesma transação dos demais efeitos.
    @Transactional(propagation = Propagation.MANDATORY)
    void registrarFaturamento(VendaEntity venda, UsuarioEntity operador) {
        pagamentos.save(new PagamentoEntity(venda, operador));
    }

    public List<PagamentoResponseDTO> listarPorVenda(Long vendaId, Long empresaId) {
        vendas.findByIdAndEmpresaId(vendaId, empresaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Venda não encontrada."));
        return pagamentos.findByEmpresaIdAndVendaIdOrderBySequenciaAsc(empresaId, vendaId)
                .stream().map(PagamentoResponseDTO::de).toList();
    }
}
