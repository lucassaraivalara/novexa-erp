package br.com.novexa.erp.entity;

public enum PerfilUsuario {
    ADMIN,
    GERENTE,
    OPERADOR,
    USUARIO;

    // Mantém o papel persistido e suas permissões; GESTOR é o nome do MVP.
    @com.fasterxml.jackson.annotation.JsonCreator
    public static PerfilUsuario de(String valor) {
        return "GESTOR".equals(valor) ? GERENTE : valueOf(valor);
    }
}
