package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.UsuarioEntity;
import br.com.novexa.erp.repository.UsuarioRepository;
import org.springframework.stereotype.Service;

@Service
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;

    // =========================================================
    // CONSTRUTOR
    // =========================================================

    // O Spring entrega o UsuarioRepository
    // através deste construtor.
    public UsuarioService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    // =========================================================
    // SALVAR
    // =========================================================

    // Responsável por cadastrar um novo usuário.
    public UsuarioEntity salvar(UsuarioEntity usuario) {

        // Verifica se já existe um usuário
        // utilizando o CPF informado.
        if (usuarioRepository.existsByCpf(usuario.getCpf())) {

            // Se existir, interrompe o cadastro.
            throw new RuntimeException(
                    "Já existe um usuário com este CPF."
            );
        }

        // Se não existir, salva o usuário no banco.
        return usuarioRepository.save(usuario);
    }

    // =========================================================
    // LISTAR
    // =========================================================

    // Busca todos os usuários cadastrados.
    public java.util.List<UsuarioEntity> listar() {

        return usuarioRepository.findAll();
    }

    // =========================================================
    // BUSCAR POR ID
    // =========================================================

    // Busca um usuário específico pelo ID.
    public UsuarioEntity buscarPorId(Long id) {

        return usuarioRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Usuário não encontrado."
                        )
                );
    }
// =========================================================
// ATUALIZAR
// =========================================================

    // Atualiza um usuário existente.
    public UsuarioEntity atualizar(
            Long id,
            UsuarioEntity dadosNovos) {

        // Primeiro procura o usuário existente no banco.
        UsuarioEntity usuarioExistente =
                usuarioRepository.findById(id)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Usuário não encontrado."
                                )
                        );

        // Verifica se o CPF informado já pertence
        // a OUTRO usuário.
        if (usuarioRepository.existsByCpfAndIdNot(
                dadosNovos.getCpf(),
                id)) {

            throw new RuntimeException(
                    "Já existe outro usuário com este CPF."
            );
        }

        // Atualiza os dados do usuário existente.
        usuarioExistente.setNomeUsuario(
                dadosNovos.getNomeUsuario()
        );

        usuarioExistente.setCpf(
                dadosNovos.getCpf()
        );

        usuarioExistente.setEmail(
                dadosNovos.getEmail()
        );

        usuarioExistente.setSenha(
                dadosNovos.getSenha()
        );

        // Salva novamente a Entity atualizada.
        return usuarioRepository.save(usuarioExistente);
    }
// =========================================================
// EXCLUIR
// =========================================================

    // Exclui um usuário pelo ID.
    public void excluir(Long id) {

        // Primeiro verifica se o usuário existe.
        if (!usuarioRepository.existsById(id)) {

            // Se não existir, informa que o usuário não foi encontrado.
            throw new RuntimeException(
                    "Usuário não encontrado."
            );
        }

        // Se existir, solicita ao Repository
        // a exclusão pelo ID.
        usuarioRepository.deleteById(id);
    }
}