package br.com.novexa.erp.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "subcategorias_produtos")
public class SubcategoriaProdutoEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "empresa_id", nullable = false) private EmpresaEntity empresa;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "categoria_id", nullable = false) private CategoriaProdutoEntity categoria;
    @Column(nullable = false, length = 100) private String nome;
    @Column(nullable = false) private boolean ativo;

    protected SubcategoriaProdutoEntity() { }
    public SubcategoriaProdutoEntity(EmpresaEntity empresa, CategoriaProdutoEntity categoria, String nome, boolean ativo) {
        this.empresa = empresa; atualizar(categoria, nome, ativo);
    }
    public void atualizar(CategoriaProdutoEntity categoria, String nome, boolean ativo) {
        this.categoria = categoria; this.nome = nome; this.ativo = ativo;
    }
    public Long getId() { return id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public CategoriaProdutoEntity getCategoria() { return categoria; }
    public String getNome() { return nome; }
    public boolean isAtivo() { return ativo; }
}
