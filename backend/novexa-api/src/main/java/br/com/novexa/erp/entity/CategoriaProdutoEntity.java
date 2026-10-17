package br.com.novexa.erp.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "categorias_produtos", uniqueConstraints = @UniqueConstraint(
        name = "uk_categoria_produto_id_empresa", columnNames = {"id", "empresa_id"}))
public class CategoriaProdutoEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "empresa_id", nullable = false) private EmpresaEntity empresa;
    @Column(nullable = false, length = 100) private String nome;
    @Column(nullable = false) private boolean ativo;

    protected CategoriaProdutoEntity() { }
    public CategoriaProdutoEntity(EmpresaEntity empresa, String nome, boolean ativo) {
        this.empresa = empresa; atualizar(nome, ativo);
    }
    public void atualizar(String nome, boolean ativo) { this.nome = nome; this.ativo = ativo; }
    public Long getId() { return id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public String getNome() { return nome; }
    public boolean isAtivo() { return ativo; }
}
