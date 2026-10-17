-- Evolução aditiva: preserva CPF/login público atual e todos os usuários.
ALTER TABLE usuario ADD COLUMN login VARCHAR(255);
ALTER TABLE usuario ADD COLUMN versao_token BIGINT NOT NULL DEFAULT 0;
UPDATE usuario SET login = regexp_replace(cpf, '\D', '', 'g') WHERE cpf IS NOT NULL;

CREATE UNIQUE INDEX uk_usuario_empresa_login ON usuario (empresa_id, lower(trim(login)))
    WHERE login IS NOT NULL AND trim(login) <> '';
-- Duplicidade legada exige regularização explícita; nunca sobrescrever cadastros.
CREATE UNIQUE INDEX uk_usuario_empresa_email ON usuario (empresa_id, lower(trim(email)))
    WHERE email IS NOT NULL AND trim(email) <> '';
