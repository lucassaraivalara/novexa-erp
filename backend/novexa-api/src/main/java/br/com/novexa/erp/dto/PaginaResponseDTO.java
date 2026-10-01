package br.com.novexa.erp.dto;

import java.util.List;

public record PaginaResponseDTO<T>(
        List<T> items,
        int page,
        int size,
        long totalItems,
        int totalPages
) {
    public static <E, T> PaginaResponseDTO<T> de(org.springframework.data.domain.Page<E> page, java.util.function.Function<E, T> mapper) {
        return new PaginaResponseDTO<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }
}