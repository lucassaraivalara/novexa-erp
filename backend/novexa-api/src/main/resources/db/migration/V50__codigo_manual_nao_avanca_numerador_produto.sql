-- Preserva o numerador V47 e os produtos existentes. Codigos manuais futuros
-- nao alteram a sequencia automatica; colisoes sao puladas sob lock do tenant.
CREATE OR REPLACE FUNCTION atribuir_codigo_interno_produto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    numero NUMERIC;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.codigo_interno IS NOT DISTINCT FROM OLD.codigo_interno THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND nullif(btrim(NEW.codigo_interno), '') IS NULL THEN
        NEW.codigo_interno := OLD.codigo_interno;
        RETURN NEW;
    END IF;

    INSERT INTO produto_codigo_numeradores (empresa_id, ultimo_codigo)
    VALUES (NEW.empresa_id, 0)
    ON CONFLICT (empresa_id) DO UPDATE SET ultimo_codigo = produto_codigo_numeradores.ultimo_codigo;

    IF nullif(btrim(NEW.codigo_interno), '') IS NULL THEN
        LOOP
            UPDATE produto_codigo_numeradores SET ultimo_codigo = ultimo_codigo + 1
            WHERE empresa_id = NEW.empresa_id RETURNING ultimo_codigo INTO numero;
            IF length(numero::text) > 60 THEN
                RAISE EXCEPTION 'Numerador do codigo interno esgotado.' USING ERRCODE = '22003';
            END IF;
            NEW.codigo_interno := numero::text;
            EXIT WHEN NOT EXISTS (SELECT 1 FROM produtos
                WHERE empresa_id = NEW.empresa_id AND codigo_interno = NEW.codigo_interno);
        END LOOP;
    ELSE
        NEW.codigo_interno := btrim(NEW.codigo_interno);
        IF NEW.codigo_interno !~ '[[:alnum:]]' OR NEW.codigo_interno ~ '[[:cntrl:]]' THEN
            RAISE EXCEPTION 'Codigo interno invalido.' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
