package br.com.novexa.erp.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name="importacoes_produtos", uniqueConstraints=@UniqueConstraint(name="uk_importacao_produto_empresa_hash", columnNames={"empresa_id","hash_arquivo"}))
public class ImportacaoProdutoEntity {
    @Id private UUID id;
    @Column(name="empresa_id", nullable=false) private Long empresaId;
    @Column(name="usuario_id", nullable=false) private Long usuarioId;
    @Column(name="hash_arquivo", nullable=false, length=64) private String hashArquivo;
    @Column(name="nome_arquivo", nullable=false) private String nomeArquivo;
    @Column(nullable=false, length=12) private String estado;
    @Column(name="previa_json", nullable=false, columnDefinition="text") private String previaJson;
    @Column(nullable=false) private int importados;
    @Column(name="criado_em", nullable=false) private LocalDateTime criadoEm;
    @Column(name="confirmado_em") private LocalDateTime confirmadoEm;
    protected ImportacaoProdutoEntity() {}
    public ImportacaoProdutoEntity(Long empresaId, Long usuarioId, String hash, String nome) {
        this.id=UUID.randomUUID(); this.empresaId=empresaId; this.usuarioId=usuarioId;
        this.hashArquivo=hash; this.nomeArquivo=nome; this.criadoEm=LocalDateTime.now();
    }
    public void previa(String json) { this.previaJson=json; this.estado="PREVIA"; }
    public void confirmar(int quantidade) { this.importados=quantidade; this.estado="CONFIRMADA"; this.confirmadoEm=LocalDateTime.now(); }
    public void cancelar() { this.estado="CANCELADA"; }
    public UUID getId() { return id; }
    public String getEstado() { return estado; }
    public String getPreviaJson() { return previaJson; }
    public String getNomeArquivo() { return nomeArquivo; }
    public int getImportados() { return importados; }
}
