package br.com.novexa.erp.service;

import br.com.novexa.erp.entity.UsuarioEntity;
import br.com.novexa.erp.repository.UsuarioRepository;
import org.springframework.stereotype.Service;

@Service
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;

    // Construtor:
    // recebe o UsuarioRepository e guarda a dependência
    // dentro do UsuarioService.
    public UsuarioService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    // Método responsável por salvar um novo usuário.
    public UsuarioEntity salvar(UsuarioEntity usuario) {

        // Verifica se já existe um usuário cadastrado
        // com o mesmo CPF.
        if (usuarioRepository.existsByCpf(usuario.getCpf())) {
            throw new RuntimeException("Já existe um usuário com este CPF.");
        }

        // Se o CPF ainda não estiver cadastrado,
        // salva o usuário no banco.
        return usuarioRepository.save(usuario);
    }
}