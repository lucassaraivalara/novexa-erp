package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import java.time.LocalDateTime;

@Entity
@Table(name = "produto_auditoria")
public class ProdutoAuditoriaEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "empresa_id")
    public EmpresaEntity empresa;

    @ManyToOne(optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "produto_id")
    public ProdutoEntity produto;

    @Column(nullable = false, length = 40)
    public String campo;

    @Column(nullable = false, length = 200)
    public String valorAnterior;

    @Column(nullable = false, length = 200)
    public String valorNovo;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id")
    public UsuarioEntity usuario;

    @Column(nullable = false)
    public LocalDateTime dataHora;
}
