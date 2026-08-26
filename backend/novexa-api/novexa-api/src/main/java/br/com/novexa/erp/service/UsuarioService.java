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
}