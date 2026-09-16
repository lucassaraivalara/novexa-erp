package br.com.novexa.erp.mapper;

import br.com.novexa.erp.dto.LoginResponseDTO;
import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.UsuarioEntity;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UsuarioMapperTest {

    private final UsuarioMapper usuarioMapper = new UsuarioMapper(new EmpresaMapper());

    @Test
    void deveIncluirEmpresaNaRespostaDeLogin() {
        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setId(10L);
        empresa.setNomeFantasia("Novexa Loja");
        empresa.setRazaoSocial("Novexa Tecnologia LTDA");
        empresa.setCnpj("12345678000190");
        empresa.setAtivo(true);
        empresa.setLogomarca("data:image/png;base64,abc123");

        UsuarioEntity usuario = new UsuarioEntity();
        usuario.setId(1L);
        usuario.setNomeUsuario("Usuário de teste");
        usuario.setCpf("02360684663");
        usuario.setEmail("teste@novexa.com");
        usuario.setEmpresa(empresa);

        LoginResponseDTO resposta = usuarioMapper.toLoginResponse(usuario);

        assertThat(resposta.getEmpresa()).isNotNull();
        assertThat(resposta.getEmpresa().getId()).isEqualTo(10L);
        assertThat(resposta.getEmpresa().getNomeFantasia()).isEqualTo("Novexa Loja");
        assertThat(resposta.getEmpresa().getLogomarca()).isEqualTo("data:image/png;base64,abc123");
    }

    @Test
    void deveRetornarLogomarcaNulaQuandoEmpresaNaoPossui() {
        EmpresaEntity empresa = new EmpresaEntity();
        empresa.setId(11L);
        empresa.setNomeFantasia("Novexa Sem Logo");
        empresa.setRazaoSocial("Novexa Tecnologia LTDA");
        empresa.setCnpj("12345678000190");
        empresa.setAtivo(true);

        UsuarioEntity usuario = new UsuarioEntity();
        usuario.setId(2L);
        usuario.setNomeUsuario("Usuário sem logo");
        usuario.setCpf("02360684663");
        usuario.setEmail("teste2@novexa.com");
        usuario.setEmpresa(empresa);

        LoginResponseDTO resposta = usuarioMapper.toLoginResponse(usuario);

        assertThat(resposta.getEmpresa().getLogomarca()).isNull();
    }
}
