package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.EmpresaEntity;
import br.com.novexa.erp.entity.PerfilUsuario;
import br.com.novexa.erp.entity.UsuarioEntity;
import br.com.novexa.erp.exception.AutenticacaoException;
import br.com.novexa.erp.exception.UsuarioNotFoundException;
import br.com.novexa.erp.repository.UsuarioRepository;
import br.com.novexa.erp.security.UsuarioAutenticado;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@org.springframework.transaction.annotation.Transactional
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
        prepararCadastro(usuario);

        if (usuarioRepository.existsByCpf(usuario.getCpf())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ja existe um usuario com este CPF.");
        }

        usuario.setSenha(criptografarSenha(usuario.getSenha()));

        if (usuario.getAtivo() == null) {
            usuario.setAtivo(true);
        }

        if (usuario.getPerfil() == null) {
            usuario.setPerfil(PerfilUsuario.OPERADOR);
        }

        return usuarioRepository.save(usuario);
    }

    public List<UsuarioEntity> listar(Long empresaId) {
        return usuarioRepository.findAllByEmpresaId(empresaId);
    }

    public UsuarioEntity buscarPorId(Long id, Long empresaId) {
        return usuarioRepository.findByIdAndEmpresaId(id, empresaId)
                .orElseThrow(() -> new UsuarioNotFoundException("Usuário não encontrado."));
    }

    public UsuarioEntity atualizar(
            Long id,
            UsuarioEntity dadosNovos,
            Long empresaId) {

        prepararCadastro(dadosNovos);

        UsuarioEntity usuarioExistente = buscarPorId(id, empresaId);

        if (usuarioRepository.existsByCpfAndIdNot(dadosNovos.getCpf(), id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ja existe outro usuario com este CPF.");
        }

        usuarioExistente.setNomeUsuario(dadosNovos.getNomeUsuario());
        usuarioExistente.setCpf(dadosNovos.getCpf());
        usuarioExistente.setEmail(dadosNovos.getEmail());
        usuarioExistente.setTelefone(dadosNovos.getTelefone());
        if (dadosNovos.getSenha() != null && !dadosNovos.getSenha().isBlank()) {
            usuarioExistente.setSenha(criptografarSenha(dadosNovos.getSenha()));
        }
        if (dadosNovos.getPerfil() != null) {
            usuarioExistente.setPerfil(dadosNovos.getPerfil());
        }
        if (dadosNovos.getAtivo() != null) {
            usuarioExistente.setAtivo(dadosNovos.getAtivo());
        }

        return usuarioRepository.save(usuarioExistente);
    }

    public UsuarioEntity alterarSituacao(Long id, Boolean ativo, UsuarioAutenticado autenticado) {
        if (ativo == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a situação do usuário.");
        }

        UsuarioEntity usuario = buscarPorId(id, autenticado.empresaId());

        if (Boolean.FALSE.equals(ativo) && usuario.getId().equals(autenticado.usuarioId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Você não pode inativar o próprio usuário conectado.");
        }

        usuario.setAtivo(ativo);
        return usuarioRepository.save(usuario);
    }

    public UsuarioEntity redefinirSenha(Long id, String senha, Long empresaId) {
        UsuarioEntity usuario = buscarPorId(id, empresaId);
        usuario.setSenha(criptografarSenha(senha));
        return usuarioRepository.save(usuario);
    }

    public void excluir(Long id, Long empresaId) {
        UsuarioEntity usuario = buscarPorId(id, empresaId);
        usuario.setAtivo(false);
        usuarioRepository.save(usuario);
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A senha e obrigatoria.");
        }
        if (senha.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Senha excede o limite de 72 bytes.");

        return passwordEncoder.encode(senha);
    }
    private void prepararCadastro(UsuarioEntity usuario) {
        if (usuario.getNomeUsuario() == null || usuario.getNomeUsuario().isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome do usuario.");
        var cpf = normalizarCpf(usuario.getCpf());
        if (cpf.length() != 11) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um CPF valido.");
        usuario.setCpf(br.com.novexa.erp.util.DocumentoUtils.normalizarEValidarCpfCnpj(cpf));
        usuario.setNomeUsuario(usuario.getNomeUsuario().trim());
    }

    private boolean senhaConfere(String senhaInformada, String senhaCriptografada) {
        if (senhaInformada == null || senhaInformada.isBlank()
                || senhaCriptografada == null || senhaCriptografada.isBlank()) {
            return false;
        }

        return passwordEncoder.matches(senhaInformada, senhaCriptografada);
    }
}
