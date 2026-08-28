package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.UsuarioEntity;
import br.com.novexa.erp.exception.AutenticacaoException;
import br.com.novexa.erp.repository.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public UsuarioService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder) {

        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public UsuarioEntity salvar(UsuarioEntity usuario) {
        usuario.setCpf(normalizarCpf(usuario.getCpf()));

        if (usuarioRepository.existsByCpf(usuario.getCpf())) {
            throw new RuntimeException("Já existe um usuário com este CPF.");
        }

        usuario.setSenha(criptografarSenha(usuario.getSenha()));

        if (usuario.getAtivo() == null) {
            usuario.setAtivo(true);
        }

        return usuarioRepository.save(usuario);
    }

    public List<UsuarioEntity> listar() {
        return usuarioRepository.findAll();
    }

    public UsuarioEntity buscarPorId(Long id) {
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Usuário não encontrado."));
    }

    public UsuarioEntity atualizar(Long id, UsuarioEntity dadosNovos) {
        dadosNovos.setCpf(normalizarCpf(dadosNovos.getCpf()));

        UsuarioEntity usuarioExistente = usuarioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Usuário não encontrado."));

        if (usuarioRepository.existsByCpfAndIdNot(dadosNovos.getCpf(), id)) {
            throw new RuntimeException("Já existe outro usuário com este CPF.");
        }

        usuarioExistente.setNomeUsuario(dadosNovos.getNomeUsuario());
        usuarioExistente.setCpf(dadosNovos.getCpf());
        usuarioExistente.setEmail(dadosNovos.getEmail());
        usuarioExistente.setSenha(criptografarSenha(dadosNovos.getSenha()));

        return usuarioRepository.save(usuarioExistente);
    }

    public void excluir(Long id) {
        if (!usuarioRepository.existsById(id)) {
            throw new RuntimeException("Usuário não encontrado.");
        }

        usuarioRepository.deleteById(id);
    }

    // O controller chama este método; o repository não é acessado diretamente pela web.
    public UsuarioEntity autenticar(String cpf, String senha) {
        String cpfNormalizado = normalizarCpf(cpf);

        UsuarioEntity usuario = usuarioRepository.findByCpfNormalizado(cpfNormalizado)
                .or(() -> usuarioRepository.findByCpf(cpfNormalizado))
                .orElseThrow(() -> new AutenticacaoException("CPF ou senha inválidos."));

        // O campo null é aceito temporariamente para não bloquear usuários antigos
        // durante a migração automática de schema do Hibernate.
        if (Boolean.FALSE.equals(usuario.getAtivo())) {
            throw new AutenticacaoException("CPF ou senha inválidos.");
        }

        if (!senhaConfere(senha, usuario.getSenha())) {
            throw new AutenticacaoException("CPF ou senha inválidos.");
        }

        return usuario;
    }

    private String normalizarCpf(String cpf) {
        return cpf == null ? "" : cpf.replaceAll("\\D", "");
    }

    private String criptografarSenha(String senha) {
        if (senha == null || senha.isBlank()) {
            throw new IllegalArgumentException("A senha é obrigatória.");
        }

        return passwordEncoder.encode(senha);
    }

    private boolean senhaConfere(String senhaInformada, String senhaCriptografada) {
        if (senhaInformada == null || senhaInformada.isBlank()
                || senhaCriptografada == null || senhaCriptografada.isBlank()) {
            return false;
        }

        return passwordEncoder.matches(senhaInformada, senhaCriptografada);
    }
}
