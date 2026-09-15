package br.com.novexa.erp.service;

import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.repository.FormaPagamentoRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class FormaPagamentoService {
    private final FormaPagamentoRepository formas;

    public FormaPagamentoService(FormaPagamentoRepository formas) { this.formas = formas; }

    public List<FormaPagamentoResponseDTO> listar() {
        return formas.findAllByOrderByDescricaoAsc().stream().map(FormaPagamentoResponseDTO::de).toList();
    }

    public FormaPagamentoResponseDTO buscar(Long id) {
        return FormaPagamentoResponseDTO.de(formas.findById(id).orElseThrow(this::naoEncontrada));
    }

    @Transactional
    public FormaPagamentoResponseDTO criar(FormaPagamentoRequestDTO pedido) {
        String descricao = validar(pedido);
        if (formas.existsByDescricaoIgnoreCase(descricao)) throw duplicada();
        return FormaPagamentoResponseDTO.de(formas.saveAndFlush(new FormaPagamentoEntity(
                descricao, pedido.tipo(), pedido.ativo() == null || pedido.ativo())));
    }

    @Transactional
    public FormaPagamentoResponseDTO atualizar(Long id, FormaPagamentoRequestDTO pedido) {
        String descricao = validar(pedido);
        var forma = formas.buscarParaAtualizar(id).orElseThrow(this::naoEncontrada);
        if (forma.getTipo() != pedido.tipo()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "O tipo não pode ser alterado. Cadastre outra forma de pagamento.");
        }
        if (formas.existsByDescricaoIgnoreCaseAndIdNot(descricao, id)) throw duplicada();
        forma.atualizar(descricao, pedido.ativo() == null ? forma.isAtivo() : pedido.ativo());
        return FormaPagamentoResponseDTO.de(formas.saveAndFlush(forma));
    }

    // Lock compartilhado até o commit do faturamento; inativação usa lock exclusivo.
    @Transactional(propagation = Propagation.MANDATORY)
    public FormaPagamentoEntity resolverParaFaturamento(FormaPagamento legado, Long id) {
        if ((legado == null) == (id == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Informe somente formaPagamentoId ou formaPagamento.");
        }
        var forma = formas.buscarParaPagamento(id != null ? id : legado.idPadrao())
                .orElseThrow(this::naoEncontrada);
        if (!forma.isAtivo()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Forma de pagamento inativa.");
        if (forma.getTipo().contratoVenda() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Este tipo ainda não está disponível para faturamento.");
        }
        if (legado != null && forma.getTipo().contratoVenda() != legado) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Forma padrão incompatível com o contrato de venda.");
        }
        return forma;
    }

    private String validar(FormaPagamentoRequestDTO pedido) {
        if (pedido.descricao() == null || pedido.descricao().isBlank()
                || pedido.descricao().length() > 150 || pedido.tipo() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe descrição válida e tipo de pagamento.");
        }
        return pedido.descricao().trim();
    }

    private ResponseStatusException naoEncontrada() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Forma de pagamento não encontrada.");
    }
    private ResponseStatusException duplicada() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Já existe uma forma de pagamento com esta descrição.");
    }
}
