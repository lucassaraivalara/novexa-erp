package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.entity.UsuarioEntity;
import br.com.novexa.erp.exception.AutenticacaoException;
import br.com.novexa.erp.repository.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final EmpresaService empresaService;
    private final PasswordEncoder passwordEncoder;

    public UsuarioService(
            UsuarioRepository usuarioRepository,
            EmpresaService empresaService,
            PasswordEncoder passwordEncoder) {

        this.usuarioRepository = usuarioRepository;
        this.empresaService = empresaService;
        this.passwordEncoder = passwordEncoder;
    }

    public UsuarioEntity salvar(UsuarioEntity usuario, Long empresaId) {
        usuario.setEmpresa(buscarEmpresaObrigatoria(empresaId));
        usuario.setCpf(normalizarCpf(usuario.getCpf()));

        if (usuarioRepository.existsByCpf(usuario.getCpf())) {
            throw new RuntimeException("Já existe um usuário com este CPF.");
        }

        usuario.setSenha(criptografarSenha(usuario.getSenha()));

        if (usuario.getAtivo() == null) {
            usuario.setAtivo(true);
        }

        if (usuario.getPerfil() == null) {
            usuario.setPerfil(PerfilUsuario.USUARIO);
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

    public UsuarioEntity atualizar(
            Long id,
            UsuarioEntity dadosNovos,
            Long empresaId) {

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
        if (dadosNovos.getPerfil() != null) {
            usuarioExistente.setPerfil(dadosNovos.getPerfil());
        }
        usuarioExistente.setEmpresa(buscarEmpresaObrigatoria(empresaId));

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

        if (usuario.getEmpresa() == null) {
            throw new AutenticacaoException(
                    "Usuário sem empresa vinculada. Vincule uma empresa antes de entrar."
            );
        }

        if (Boolean.FALSE.equals(usuario.getEmpresa().getAtivo())) {
            throw new AutenticacaoException("A empresa vinculada ao usuário está inativa.");
        }

        return usuario;
    }

    private EmpresaEntity buscarEmpresaObrigatoria(Long empresaId) {
        if (empresaId == null) {
            throw new IllegalArgumentException("A empresa é obrigatória para o usuário.");
        }

        return empresaService.buscarPorId(empresaId);
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
