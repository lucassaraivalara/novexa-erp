package br.com.novexa.erp.service;

import br.com.novexa.erp.controller.EmpresaController;
import br.com.novexa.erp.dto.*;
import br.com.novexa.erp.entity.*;
import br.com.novexa.erp.exception.*;
import br.com.novexa.erp.mapper.EmpresaMapper;
import br.com.novexa.erp.repository.EmpresaRepository;
import br.com.novexa.erp.util.DocumentoEmpresaUtils;
import br.com.novexa.erp.util.LogomarcaUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import br.com.novexa.erp.security.UsuarioAutenticado;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.*;
import javax.imageio.ImageIO;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class EmpresaCadastroTest {
    private EmpresaRepository repository;
    private EmpresaService service;
    private EmpresaMapper mapper;
    private MockMvc mvc;
    private final ObjectMapper json = new ObjectMapper();

    @BeforeEach
    void preparar() {
        repository = mock(EmpresaRepository.class);
        service = new EmpresaService(repository);
        mapper = new EmpresaMapper();
        mvc = MockMvcBuilders.standaloneSetup(new EmpresaController(service, mapper))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new UsuarioAutenticado(1L, "02360684663", 7L, PerfilUsuario.USUARIO),
                        null, List.of()));
        when(repository.save(any())).thenAnswer(i -> {
            EmpresaEntity empresa = i.getArgument(0);
            if (empresa.getId() == null) empresa.setId(7L);
            return empresa;
        });
    }

    @AfterEach
    void limparAutenticacao() {
        SecurityContextHolder.clearContext();
    }

    private EmpresaRequestDTO dados() {
        var dto = new EmpresaRequestDTO();
        dto.setRazaoSocial("Distribuidora Teste");
        dto.setCnpj("11.222.333/0001-81");
        dto.setAtivo(true);
        var cadastro = new EmpresaCadastroDados();
        cadastro.setRegimeTributario(RegimeTributario.LUCRO_PRESUMIDO);
        cadastro.setUf("SP");
        dto.setCadastro(cadastro);
        dto.setInscricoesSt(new ArrayList<>(List.of(new EmpresaInscricaoStDTO("MG", "00123456", true))));
        return dto;
    }

    @Test void criaEmpresaComCincoGruposEInscricoes() throws Exception {
        var dto = dados();
        dto.getCadastro().setCidade("São Paulo");
        dto.getCadastro().setContadorNome("Contador Teste");
        dto.getCadastro().setContadorCidade("São Paulo");
        dto.getCadastro().setRegimePisCofins("1");
        dto.getCadastro().setLatitude(new java.math.BigDecimal("-23.5505200"));
        dto.getCadastro().setLongitude(new java.math.BigDecimal("-46.6333080"));
        mvc.perform(post("/empresas").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dto)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(7))
                .andExpect(jsonPath("$.cnpj").value("11222333000181"))
                .andExpect(jsonPath("$.cadastro.contadorCidade").value("São Paulo"))
                .andExpect(jsonPath("$.cadastro.latitude").value(-23.55052))
                .andExpect(jsonPath("$.inscricoesSt[0].inscricaoEstadual").value("00123456"))
                .andExpect(jsonPath("$.inscricoesSt[0].difal").value(true));
    }

    @Test void putTambemValidaCamposObrigatorios() throws Exception {
        var dto = dados(); dto.setRazaoSocial(" "); dto.getCadastro().setRegimeTributario(null);
        mvc.perform(put("/empresas/7").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dto)))
                .andExpect(status().isBadRequest());
        verify(repository, never()).save(any());
    }

    @Test void exigeRegimeNaCriacao() throws Exception {
        var dto = dados(); dto.getCadastro().setRegimeTributario(null);
        mvc.perform(post("/empresas").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dto)))
                .andExpect(status().isBadRequest());
        verify(repository, never()).save(any());
    }

    @Test void validaDadosAninhadosAntesDeSalvar() throws Exception {
        var dto = dados(); dto.getCadastro().setDiaVencimentoIcms(32);
        dto.getCadastro().setPerfilEfd("Z");
        dto.setInscricoesSt(List.of(new EmpresaInscricaoStDTO("XX", "", false)));
        mvc.perform(post("/empresas").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dto)))
                .andExpect(status().isBadRequest());
        verify(repository, never()).save(any());
    }

    @Test void exigeAsDuasCoordenadas() throws Exception {
        var dto = dados(); dto.getCadastro().setLatitude(java.math.BigDecimal.ZERO);
        mvc.perform(post("/empresas").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dto)))
                .andExpect(status().isBadRequest()).andExpect(content().string("Preencha latitude e longitude juntas."));
    }

    @Test void cpfSomenteParaProdutorRural() {
        var empresa = mapper.paraEntity(dados()); empresa.setCnpj("529.982.247-25");
        assertThatThrownBy(() -> service.salvar(empresa)).isInstanceOf(EmpresaInvalidaException.class);
        empresa.getCadastro().setProdutorRural(true);
        assertThat(service.salvar(empresa).getCnpj()).isEqualTo("52998224725");
    }

    @Test void validaCnpjAlfanumericoENaoDescartaCaracteresInvalidos() {
        assertThat(DocumentoEmpresaUtils.validar("12.ABC.345/01DE-35", false)).isEqualTo("12ABC34501DE35");
        assertThatThrownBy(() -> DocumentoEmpresaUtils.validar("12.ABC.345/01DE-36", false)).isInstanceOf(EmpresaInvalidaException.class);
        assertThatThrownBy(() -> DocumentoEmpresaUtils.validar("11.222.333/0001-81!", false)).isInstanceOf(EmpresaInvalidaException.class);
    }

    @Test void documentoDuplicadoRetornaConflito() throws Exception {
        when(repository.documentoEmUso("11222333000181", null)).thenReturn(true);
        mvc.perform(post("/empresas").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(dados())))
                .andExpect(status().isConflict());
        verify(repository, never()).save(any());
    }

    @Test void rejeitaInscricaoRepetidaEInscricaoNaUfDaEmpresa() {
        var dto = dados();
        dto.getInscricoesSt().add(new EmpresaInscricaoStDTO("MG", "00999", false));
        assertThatThrownBy(() -> service.salvar(mapper.paraEntity(dto))).hasMessageContaining("uma inscrição");
        dto.setInscricoesSt(List.of(new EmpresaInscricaoStDTO("SP", "123", false)));
        assertThatThrownBy(() -> service.salvar(mapper.paraEntity(dto))).hasMessageContaining("outra UF");
    }

    @Test void atualizaInscricoesPreservandoIdentidadeEUsuarios() {
        var existente = mapper.paraEntity(dados()); existente.setId(7L);
        existente.setEndereco("Endereço anterior");
        var usuario = new UsuarioEntity(); existente.getUsuarios().add(usuario);
        var inscricao = existente.getInscricoesSt().getFirst();
        when(repository.findById(7L)).thenReturn(Optional.of(existente));
        var dto = dados(); dto.setEndereco("Endereço anterior");
        dto.setInscricoesSt(List.of(new EmpresaInscricaoStDTO("MG", "0000888", false), new EmpresaInscricaoStDTO("RJ", "0000999", true)));
        var salva = service.atualizarPorId(7L, mapper.paraEntity(dto));
        assertThat(salva.getUsuarios()).containsExactly(usuario);
        assertThat(salva.getEndereco()).isEqualTo("Endereço anterior");
        assertThat(salva.getInscricoesSt().getFirst()).isSameAs(inscricao);
        assertThat(inscricao.getInscricaoEstadual()).isEqualTo("0000888");
        assertThat(salva.getInscricoesSt()).allMatch(i -> i.getEmpresa() == salva);
        dto.setInscricoesSt(List.of());
        assertThat(service.atualizarPorId(7L, mapper.paraEntity(dto)).getInscricoesSt()).isEmpty();
    }

    @Test void cidadeObrigatoriaMesmoQuandoSoContatoDoContadorFoiPreenchido() {
        var dto = dados(); dto.getCadastro().setContadorEmail("contador@example.com");
        assertThatThrownBy(() -> service.salvar(mapper.paraEntity(dto))).hasMessageContaining("cidade do contador");
    }

    @Test void detalheRetornaInscricoesMasListagemNaoTransportaImagem() throws Exception {
        var empresa = mapper.paraEntity(dados()); empresa.setId(7L); empresa.setLogomarca("imagem");
        when(repository.findById(7L)).thenReturn(Optional.of(empresa));
        mvc.perform(get("/empresas/7")).andExpect(status().isOk())
                .andExpect(jsonPath("$.inscricoesSt[0].uf").value("MG")).andExpect(jsonPath("$.logomarca").value("imagem"));
        mvc.perform(get("/empresas")).andExpect(status().isOk()).andExpect(jsonPath("$[0].logomarca").isEmpty());
    }

    @Test void permiteConsultarEmpresaLegadaSemCadastroComplementar() throws Exception {
        var empresa = new EmpresaEntity(); empresa.setId(7L); empresa.setCadastro(null);
        when(repository.findById(7L)).thenReturn(Optional.of(empresa));
        mvc.perform(get("/empresas/7")).andExpect(status().isOk()).andExpect(jsonPath("$.inscricoesSt").isEmpty());
    }

    @Test void validaImagemRealERejeitaConteudoFalso() throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", bytes);
        var logo = "data:image/png;base64," + Base64.getEncoder().encodeToString(bytes.toByteArray());
        assertThat(LogomarcaUtils.validar(logo)).isEqualTo(logo);
        assertThat(LogomarcaUtils.validar(null)).isNull();
        assertThatThrownBy(() -> LogomarcaUtils.validar("data:image/png;base64,ZmFrZQ==")).isInstanceOf(EmpresaInvalidaException.class);
        assertThatThrownBy(() -> LogomarcaUtils.validar(logo.replace("image/png", "image/jpeg"))).isInstanceOf(EmpresaInvalidaException.class);
        assertThatThrownBy(() -> LogomarcaUtils.validar("data:image/svg+xml;base64,PHN2Zz4=")).isInstanceOf(EmpresaInvalidaException.class);
    }

    @Test void geocodificacaoSemConfiguracaoNaoConsultaProvedor() {
        var geo = new EmpresaGeocodificacaoService("", "teste");
        assertThat(geo.configurado()).isFalse();
        assertThatThrownBy(() -> geo.buscar("Endereço")).isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                .hasMessageContaining("503");
    }
}
