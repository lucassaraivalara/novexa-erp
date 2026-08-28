package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.UsuarioEntity;
import br.com.novexa.erp.exception.AutenticacaoException;
import br.com.novexa.erp.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    private PasswordEncoder passwordEncoder;
    private UsuarioService usuarioService;

    @BeforeEach
    void configurar() {
        passwordEncoder = new BCryptPasswordEncoder();
        usuarioService = new UsuarioService(usuarioRepository, passwordEncoder);
    }

    @Test
    void deveSalvarSenhaCriptografada() {
        UsuarioEntity usuario = criarUsuario("senha123", true);

        when(usuarioRepository.existsByCpf("02360684663")).thenReturn(false);
        when(usuarioRepository.save(any(UsuarioEntity.class)))
                .thenAnswer(invocacao -> invocacao.getArgument(0));

        UsuarioEntity usuarioSalvo = usuarioService.salvar(usuario);

        assertThat(usuarioSalvo.getSenha()).isNotEqualTo("senha123");
        assertThat(passwordEncoder.matches("senha123", usuarioSalvo.getSenha())).isTrue();
        assertThat(usuarioSalvo.getAtivo()).isTrue();
    }

    @Test
    void deveAutenticarUsuarioComCpfFormatadoESenhaCorreta() {
        UsuarioEntity usuario = criarUsuario(passwordEncoder.encode("senha123"), true);

        when(usuarioRepository.findByCpfNormalizado("02360684663"))
                .thenReturn(Optional.of(usuario));

        UsuarioEntity usuarioAutenticado = usuarioService.autenticar(
                "023.606.846-63",
                "senha123"
        );

        assertThat(usuarioAutenticado).isSameAs(usuario);
    }

    @Test
    void deveRecusarSenhaIncorreta() {
        UsuarioEntity usuario = criarUsuario(passwordEncoder.encode("senha123"), true);

        when(usuarioRepository.findByCpfNormalizado("02360684663"))
                .thenReturn(Optional.of(usuario));

        assertThatThrownBy(() -> usuarioService.autenticar("02360684663", "senhaErrada"))
                .isInstanceOf(AutenticacaoException.class)
                .hasMessage("CPF ou senha inválidos.");
    }

    @Test
    void deveRecusarUsuarioInativo() {
        UsuarioEntity usuario = criarUsuario(passwordEncoder.encode("senha123"), false);

        when(usuarioRepository.findByCpfNormalizado("02360684663"))
                .thenReturn(Optional.of(usuario));

        assertThatThrownBy(() -> usuarioService.autenticar("02360684663", "senha123"))
                .isInstanceOf(AutenticacaoException.class)
                .hasMessage("CPF ou senha inválidos.");
    }

    @Test
    void deveRecusarCpfInexistente() {
        when(usuarioRepository.findByCpfNormalizado("02360684663"))
                .thenReturn(Optional.empty());
        when(usuarioRepository.findByCpf("02360684663"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> usuarioService.autenticar("02360684663", "senha123"))
                .isInstanceOf(AutenticacaoException.class)
                .hasMessage("CPF ou senha inválidos.");
    }

    private UsuarioEntity criarUsuario(String senha, boolean ativo) {
        UsuarioEntity usuario = new UsuarioEntity();
        usuario.setId(1L);
        usuario.setNomeUsuario("Usuário de teste");
        usuario.setCpf("02360684663");
        usuario.setEmail("teste@novexa.com");
        usuario.setSenha(senha);
        usuario.setAtivo(ativo);
        return usuario;
    }
}
