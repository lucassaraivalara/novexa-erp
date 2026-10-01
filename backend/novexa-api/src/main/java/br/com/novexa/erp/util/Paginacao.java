package br.com.novexa.erp.util;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.Set;

public final class Paginacao {
    private Paginacao() { }

    public static PageRequest criar(int page, int size, String sort, Set<String> campos, Sort.Direction desempate) {
        if (page < 0 || size < 1 || size > 100) throw invalida("page deve ser >= 0 e size entre 1 e 100.");
        String[] partes = sort == null ? new String[0] : sort.split(",", -1);
        if (partes.length != 2 || !campos.contains(partes[0])
                || !(partes[1].equals("asc") || partes[1].equals("desc")))
            throw invalida("Ordenacao invalida. Use campo,asc ou campo,desc.");
        Sort ordem = Sort.by(Sort.Direction.fromString(partes[1]), partes[0]);
        if (!partes[0].equals("id")) ordem = ordem.and(Sort.by(desempate, "id"));
        return PageRequest.of(page, size, ordem);
    }

    public static ResponseStatusException invalida(String mensagem) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, mensagem);
    }
}
