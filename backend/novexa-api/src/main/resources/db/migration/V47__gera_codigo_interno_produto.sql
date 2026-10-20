-- Numerador por empresa. Não renumera nem modifica produtos legados.
CREATE TABLE produto_codigo_numeradores (
    empresa_id BIGINT PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
    ultimo_codigo NUMERIC(60,0) NOT NULL DEFAULT 0 CHECK (ultimo_codigo >= 0)
);

-- Nenhuma inserção/edição pode passar entre a leitura inicial e o trigger.
LOCK TABLE produtos IN SHARE ROW EXCLUSIVE MODE;
-- MAX somente na migração, nunca no cadastro.
INSERT INTO produto_codigo_numeradores (empresa_id, ultimo_codigo)
SELECT empresa_id, MAX(btrim(codigo_interno)::numeric)
FROM produtos WHERE btrim(codigo_interno) ~ '^[0-9]{1,60}$'
GROUP BY empresa_id;

CREATE FUNCTION atribuir_codigo_interno_produto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    numero NUMERIC;
BEGIN
    -- Edições comuns não renumeram nem validam retroativamente o legado.
    IF TG_OP = 'UPDATE' AND NEW.codigo_interno IS NOT DISTINCT FROM OLD.codigo_interno THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND nullif(btrim(NEW.codigo_interno), '') IS NULL THEN
        NEW.codigo_interno := OLD.codigo_interno;
        RETURN NEW;
    END IF;

    -- O UPSERT bloqueia a linha do tenant até commit/rollback, inclusive na
    -- primeira criação e para códigos manuais/importados. Nunca usar MAX + 1.
    INSERT INTO produto_codigo_numeradores (empresa_id, ultimo_codigo)
    VALUES (NEW.empresa_id, 0)
    ON CONFLICT (empresa_id) DO UPDATE SET ultimo_codigo = produto_codigo_numeradores.ultimo_codigo;

    IF nullif(btrim(NEW.codigo_interno), '') IS NULL THEN
        LOOP
            UPDATE produto_codigo_numeradores SET ultimo_codigo = ultimo_codigo + 1
            WHERE empresa_id = NEW.empresa_id RETURNING ultimo_codigo INTO numero;
            IF length(numero::text) > 60 THEN
                RAISE EXCEPTION 'Numerador do código interno esgotado.' USING ERRCODE = '22003';
            END IF;
            NEW.codigo_interno := numero::text;
            EXIT WHEN NOT EXISTS (SELECT 1 FROM produtos
                WHERE empresa_id = NEW.empresa_id AND codigo_interno = NEW.codigo_interno);
        END LOOP;
    ELSE
        NEW.codigo_interno := btrim(NEW.codigo_interno);
        IF NEW.codigo_interno !~ '[[:alnum:]]' OR NEW.codigo_interno ~ '[[:cntrl:]]' THEN
            RAISE EXCEPTION 'Código interno inválido.' USING ERRCODE = '23514';
        END IF;
        -- Não reutilizar na geração números manuais já usados, mesmo após
        -- inativação, exclusão física ou edição do código do produto.
        IF NEW.codigo_interno ~ '^[0-9]{1,60}$' THEN
            UPDATE produto_codigo_numeradores
            SET ultimo_codigo = greatest(ultimo_codigo, NEW.codigo_interno::numeric)
            WHERE empresa_id = NEW.empresa_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_produto_codigo_interno
BEFORE INSERT OR UPDATE OF codigo_interno ON produtos
FOR EACH ROW EXECUTE FUNCTION atribuir_codigo_interno_produto();
