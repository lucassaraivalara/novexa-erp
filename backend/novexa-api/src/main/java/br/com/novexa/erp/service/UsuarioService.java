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
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import br.com.novexa.erp.dto.PaginaResponseDTO;
import br.com.novexa.erp.dto.UsuarioResponseDTO;
import br.com.novexa.erp.mapper.UsuarioMapper;
import br.com.novexa.erp.util.Paginacao;
import org.springframework.data.domain.Sort;

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
        usuarioRepository.bloquearAdministracao(empresaId);
        prepararCadastro(usuario);
        if (usuario.getLogin() == null || usuario.getLogin().isBlank()) usuario.setLogin(usuario.getCpf());
        validarIdentificadores(usuario, empresaId, -1L);

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

    public PaginaResponseDTO<UsuarioResponseDTO> listarPagina(Long empresaId, String termo, Boolean ativo,
            int page, int size, String sort, UsuarioMapper mapper) {
        String texto = termo == null ? "" : termo.trim().toLowerCase(Locale.ROOT);
        String documento = texto.matches("[0-9.\\- ]+") ? normalizarCpf(texto) : texto;
        return PaginaResponseDTO.de(usuarioRepository.listarPagina(empresaId, padrao(texto), padrao(documento), ativo,
                Paginacao.criar(page, size, sort, Set.of("id", "nomeUsuario", "cpf", "login", "email", "perfil", "ativo"),
                        Sort.Direction.ASC)), mapper::toResponse);
    }

    private String padrao(String texto) {
        return "%" + texto.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
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
        usuarioRepository.bloquearAdministracao(empresaId);
        UsuarioEntity usuarioExistente = buscarPorId(id, empresaId);
        if (dadosNovos.getLogin() == null) dadosNovos.setLogin(usuarioExistente.getLogin());
        if (dadosNovos.getLogin() == null) dadosNovos.setLogin(dadosNovos.getCpf());
        validarIdentificadores(dadosNovos, empresaId, id);
        validarProtecao(usuarioExistente, dadosNovos.getAtivo(), dadosNovos.getPerfil(), dadosNovos.getCpf());

        if (usuarioRepository.existsByCpfAndIdNot(dadosNovos.getCpf(), id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ja existe outro usuario com este CPF.");
        }

        usuarioExistente.setNomeUsuario(dadosNovos.getNomeUsuario());
        usuarioExistente.setLogin(dadosNovos.getLogin());
        boolean mudouAcesso = !Objects.equals(usuarioExistente.getCpf(), dadosNovos.getCpf())
                || (dadosNovos.getAtivo() != null && !Objects.equals(usuarioExistente.getAtivo(), dadosNovos.getAtivo()))
                || (dadosNovos.getPerfil() != null && usuarioExistente.getPerfil() != dadosNovos.getPerfil());
        usuarioExistente.setCpf(dadosNovos.getCpf());
        usuarioExistente.setEmail(dadosNovos.getEmail());
        usuarioExistente.setTelefone(dadosNovos.getTelefone());
        if (dadosNovos.getSenha() != null && !dadosNovos.getSenha().isBlank()) {
            usuarioExistente.setSenha(criptografarSenha(dadosNovos.getSenha()));
            mudouAcesso = true;
        }
        if (dadosNovos.getPerfil() != null) {
            usuarioExistente.setPerfil(dadosNovos.getPerfil());
        }
        if (dadosNovos.getAtivo() != null) {
            usuarioExistente.setAtivo(dadosNovos.getAtivo());
        }

        if (mudouAcesso) usuarioExistente.invalidarTokens();
        return usuarioRepository.save(usuarioExistente);
    }

    public UsuarioEntity alterarSituacao(Long id, Boolean ativo, UsuarioAutenticado autenticado) {
        if (ativo == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a situação do usuário.");
        }

        usuarioRepository.bloquearAdministracao(autenticado.empresaId());
        UsuarioEntity usuario = buscarPorId(id, autenticado.empresaId());

        if (Boolean.FALSE.equals(ativo) && usuario.getId().equals(autenticado.usuarioId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Você não pode inativar o próprio usuário conectado.");
        }

        validarProtecao(usuario, ativo, null, usuario.getCpf());
        if (!Objects.equals(usuario.getAtivo(), ativo)) usuario.invalidarTokens();
        usuario.setAtivo(ativo);
        return usuarioRepository.save(usuario);
    }

    public UsuarioEntity redefinirSenha(Long id, String senha, Long empresaId) {
        usuarioRepository.bloquearAdministracao(empresaId);
        UsuarioEntity usuario = buscarPorId(id, empresaId);
        usuario.setSenha(criptografarSenha(senha));
        usuario.invalidarTokens();
        return usuarioRepository.save(usuario);
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
        if (usuario.getLogin() != null) {
            usuario.setLogin(usuario.getLogin().trim().toLowerCase(Locale.ROOT));
            if (usuario.getLogin().isBlank())
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o login do usuário.");
        }
        if (usuario.getEmail() != null) usuario.setEmail(usuario.getEmail().trim().toLowerCase(Locale.ROOT));
    }

    private void validarIdentificadores(UsuarioEntity usuario, Long empresaId, Long id) {
        if (usuarioRepository.loginEmUso(empresaId, id, usuario.getLogin()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe um usuário com este login nesta empresa.");
        if (usuario.getEmail() != null && !usuario.getEmail().isBlank()
                && usuarioRepository.emailEmUso(empresaId, id, usuario.getEmail()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe um usuário com este e-mail nesta empresa.");
    }

    private void validarProtecao(UsuarioEntity usuario, Boolean ativo, PerfilUsuario perfil, String cpf) {
        boolean retiraAdmin = Boolean.FALSE.equals(ativo) || (perfil != null && perfil != PerfilUsuario.ADMIN);
        if (usuario.getPerfil() == PerfilUsuario.ADMIN && "02360684663".equals(normalizarCpf(usuario.getCpf()))
                && (retiraAdmin || !normalizarCpf(usuario.getCpf()).equals(normalizarCpf(cpf))))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "O administrador preservado não pode ser inativado, removido ou rebaixado.");
        if (usuario.getPerfil() == PerfilUsuario.ADMIN && !Boolean.FALSE.equals(usuario.getAtivo()) && retiraAdmin
                && usuarioRepository.countByEmpresaIdAndPerfilAndAtivoTrue(usuario.getEmpresa().getId(), PerfilUsuario.ADMIN) <= 1)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A empresa deve manter pelo menos um ADMIN ativo.");
    }

    private boolean senhaConfere(String senhaInformada, String senhaCriptografada) {
        if (senhaInformada == null || senhaInformada.isBlank()
                || senhaCriptografada == null || senhaCriptografada.isBlank()) {
            return false;
        }

        return passwordEncoder.matches(senhaInformada, senhaCriptografada);
    }
}
