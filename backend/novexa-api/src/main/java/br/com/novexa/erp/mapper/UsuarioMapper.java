package br.com.novexa.erp.mapper;

import br.com.novexa.erp.dto.LoginResponseDTO;
import br.com.novexa.erp.dto.UsuarioRequestDTO;
import br.com.novexa.erp.dto.UsuarioResponseDTO;
import br.com.novexa.erp.entity.UsuarioEntity;
import org.springframework.stereotype.Component;

@Component
public class UsuarioMapper {

    private final EmpresaMapper empresaMapper;

    public UsuarioMapper(EmpresaMapper empresaMapper) {
        this.empresaMapper = empresaMapper;
    }

    // =========================================================
    // REQUEST DTO → ENTITY
    // =========================================================

    // Converte os dados recebidos pela API
    // em uma UsuarioEntity.
    public UsuarioEntity toEntity(UsuarioRequestDTO request) {

        // Cria um novo objeto UsuarioEntity.
        UsuarioEntity usuario = new UsuarioEntity();

        // Copia os dados do DTO para a Entity.
        usuario.setNomeUsuario(request.getNomeUsuario());
        usuario.setCpf(request.getCpf());
        usuario.setEmail(request.getEmail());
        usuario.setSenha(request.getSenha());
        usuario.setPerfil(request.getPerfil());

        // Retorna a Entity preenchida.
        return usuario;
    }

    // =========================================================
    // ENTITY → RESPONSE DTO
    // =========================================================

    // Converte uma UsuarioEntity em
    // UsuarioResponseDTO para devolver pela API.
    public UsuarioResponseDTO toResponse(UsuarioEntity usuario) {

        // Cria um novo objeto de resposta.
        UsuarioResponseDTO response = new UsuarioResponseDTO();

        // Copia os dados da Entity para o ResponseDTO.
        response.setId(usuario.getId());
        response.setNomeUsuario(usuario.getNomeUsuario());
        response.setCpf(usuario.getCpf());
        response.setEmail(usuario.getEmail());
        response.setPerfil(usuario.getPerfil());
        response.setEmpresa(empresaMapper.paraResponseDTO(usuario.getEmpresa()));

        // A senha não é copiada para o ResponseDTO.

        // Retorna o DTO de resposta.
        return response;
    }

    public LoginResponseDTO toLoginResponse(UsuarioEntity usuario) {
        LoginResponseDTO response = new LoginResponseDTO();

        response.setId(usuario.getId());
        response.setNomeUsuario(usuario.getNomeUsuario());
        response.setCpf(usuario.getCpf());
        response.setEmail(usuario.getEmail());
        response.setPerfil(usuario.getPerfil());
        response.setEmpresa(empresaMapper.paraResponseDTO(usuario.getEmpresa()));

        return response;
    }
    public void updateEntity(
            UsuarioRequestDTO request,
            UsuarioEntity usuario) {

        // Atualiza o nome do usuário.
        usuario.setNomeUsuario(request.getNomeUsuario());

        // Atualiza o CPF.
        usuario.setCpf(request.getCpf());

        // Atualiza o e-mail.
        usuario.setEmail(request.getEmail());

        // Atualiza a senha.
        usuario.setSenha(request.getSenha());
    }
}
