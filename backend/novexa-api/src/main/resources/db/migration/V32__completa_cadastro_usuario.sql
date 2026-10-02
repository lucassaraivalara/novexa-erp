ALTER TABLE usuario ADD COLUMN telefone VARCHAR(30);

-- Login por CPF e global. Preserva os dados; duplicidade legada exige regularizacao explicita.
CREATE UNIQUE INDEX uk_usuario_cpf_normalizado ON usuario ((regexp_replace(cpf, '\D', '', 'g')))
    WHERE cpf IS NOT NULL AND regexp_replace(cpf, '\D', '', 'g') <> '';
