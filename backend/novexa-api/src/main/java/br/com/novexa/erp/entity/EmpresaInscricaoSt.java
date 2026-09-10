package br.com.novexa.erp.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "empresa_inscricoes_st", uniqueConstraints =
        @UniqueConstraint(name = "uk_empresa_inscricao_uf", columnNames = {"empresa_id", "uf"}))
public class EmpresaInscricaoSt {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "empresa_id", nullable = false, foreignKey = @ForeignKey(name = "fk_inscricao_st_empresa"))
    private EmpresaEntity empresa;

    @Column(nullable = false, length = 2)
    private String uf;

    @Column(name = "inscricao_estadual", nullable = false, length = 20)
    private String inscricaoEstadual;

    @Column(nullable = false)
    private boolean difal;

    public Long getId() { return id; }
    public EmpresaEntity getEmpresa() { return empresa; }
    public void setEmpresa(EmpresaEntity valor) { empresa = valor; }
    public String getUf() { return uf; }
    public void setUf(String valor) { uf = valor; }
    public String getInscricaoEstadual() { return inscricaoEstadual; }
    public void setInscricaoEstadual(String valor) { inscricaoEstadual = valor; }
    public boolean isDifal() { return difal; }
    public void setDifal(boolean valor) { difal = valor; }
}
