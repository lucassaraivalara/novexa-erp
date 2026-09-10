package br.com.novexa.erp.repository;

import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.service.EmpresaService;
import br.com.novexa.erp.mapper.EmpresaMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import static org.assertj.core.api.Assertions.*;

@DataJpaTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:empresa;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
@Import(EmpresaService.class)
class EmpresaPersistenceTest {
    @Autowired EmpresaRepository repository;
    @Autowired EmpresaService service;
    @Autowired TestEntityManager em;

    private EmpresaEntity empresa() {
        var e = new EmpresaEntity();
        e.setRazaoSocial("Empresa teste"); e.setCnpj("11222333000181"); e.setAtivo(true);
        e.getCadastro().setRegimeTributario(RegimeTributario.SIMPLES_NACIONAL);
        e.getCadastro().setLatitude(new java.math.BigDecimal("-23.5505200"));
        e.getCadastro().setLongitude(new java.math.BigDecimal("-46.6333080"));
        return e;
    }

    private void inscricao(EmpresaEntity e, String uf, String ie) {
        var i = new EmpresaInscricaoSt(); i.setEmpresa(e); i.setUf(uf); i.setInscricaoEstadual(ie); i.setDifal(true);
        e.getInscricoesSt().add(i);
    }

    @Test void gravaReabreAtualizaERemoveFilhosSemDuplicarUf() {
        var original = empresa(); inscricao(original, "MG", "00123"); inscricao(original, "RJ", "00456");
        var id = service.salvar(original).getId();
        em.flush(); em.clear();
        var salva = repository.findById(id).orElseThrow();
        assertThat(salva.getInscricoesSt()).hasSize(2);
        assertThat(salva.getCadastro().getLatitude()).isEqualByComparingTo("-23.5505200");
        var nova = empresa(); inscricao(nova, "MG", "00999"); inscricao(nova, "ES", "00777");
        service.atualizarPorId(id, nova);
        em.flush(); em.clear();
        var detalhe = new EmpresaMapper().paraDetalheDTO(repository.findById(id).orElseThrow());
        assertThat(detalhe.getInscricoesSt()).extracting(i -> i.uf()).containsExactly("ES", "MG");
        assertThat(detalhe.getInscricoesSt()).extracting(i -> i.inscricaoEstadual()).containsExactly("00777", "00999");
        Number quantidade = (Number) em.getEntityManager().createNativeQuery("select count(*) from empresa_inscricoes_st where empresa_id = :id").setParameter("id", id).getSingleResult();
        assertThat(quantidade.intValue()).isEqualTo(2);
        service.atualizarPorId(id, empresa()); em.flush(); em.clear();
        assertThat(repository.findById(id).orElseThrow().getInscricoesSt()).isEmpty();
    }

    @Test void detectaDocumentoAntigoComMascaraEIgnoraAPropriaEmpresa() {
        var e = empresa(); e.setCnpj("11.222.333/0001-81");
        var id = repository.saveAndFlush(e).getId();
        assertThat(repository.documentoEmUso("11222333000181", null)).isTrue();
        assertThat(repository.documentoEmUso("11222333000181", id)).isFalse();
    }

    @Test void empresaAntigaPodeExistirSemRegimePreenchido() {
        var e = empresa(); e.setCadastro(null);
        var id = repository.saveAndFlush(e).getId(); em.clear();
        assertThat(repository.findById(id)).isPresent();
    }

    @Test void bancoImpedeInscricaoDuplicada() {
        var e = empresa(); inscricao(e, "MG", "001"); inscricao(e, "MG", "002");
        assertThatThrownBy(() -> repository.saveAndFlush(e)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
}