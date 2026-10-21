-- Regularização excepcional de dados da empresa 1 (Mustache Smoke Shop).
-- Renumerar TODOS os códigos internos em sequência 1..N, ordenada pelo valor
-- numérico do código atual (menor → maior; sem código numérico por último, por id),
-- mover EANs de 13 dígitos gravados no código interno para codigo_barras,
-- limpar o barcode vazado (código interno automático copiado no campo de EAN)
-- e realinhar o numerador da V47 (próximo código automático = N+1).
-- Não é migration Flyway e não deve ser executado automaticamente.
-- Pré-requisito: carga dos produtos faltantes (acao=incluir) já aplicada.
-- Operação única; após executada e validada, registrar como operação histórica.
\set ON_ERROR_STOP on
-- Total esperado de produtos da empresa 1 NA HORA da execução (conferir no preview):
\set expected_total 598

-- PRÉ-VALIDAÇÃO (READ-ONLY)
SELECT count(*) AS produtos_empresa1 FROM produtos WHERE empresa_id = 1;
SELECT ultimo_codigo AS numerador_atual FROM produto_codigo_numeradores WHERE empresa_id = 1;
SELECT id, nome, codigo_interno, codigo_barras
  FROM produtos
 WHERE empresa_id = 1 AND codigo_interno ~ '^[0-9]{13}$'
 ORDER BY id;
-- EAN de 13 dígitos do código interno que já existe como barcode de OUTRO produto (deve voltar vazio):
SELECT p.id, p.codigo_interno, b.id AS barcode_em_outro
  FROM produtos p JOIN produtos b ON b.empresa_id = p.empresa_id
    AND b.codigo_barras = p.codigo_interno AND b.id <> p.id
 WHERE p.empresa_id = 1 AND p.codigo_interno ~ '^[0-9]{13}$';

BEGIN;

-- Trava a operação inteira contra vendas/cadastros concorrentes (duração: segundos).
LOCK TABLE produtos IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
    total_antes BIGINT;
    total_numerico BIGINT;
    sem_codigo BIGINT;
    nao_numerico BIGINT;
    conflito_barras BIGINT;
    ean_duplicado BIGINT;
BEGIN
    SELECT count(*) INTO total_antes FROM produtos WHERE empresa_id = 1;
    IF total_antes <> :expected_total THEN
        RAISE EXCEPTION 'Quantidade de produtos (%) difere do esperado (:expected_total); abortado.', total_antes;
    END IF;
    SELECT count(*) INTO total_numerico FROM produtos
     WHERE empresa_id = 1 AND btrim(codigo_interno) ~ '^[0-9]+$';
    SELECT count(*) INTO sem_codigo FROM produtos
     WHERE empresa_id = 1 AND nullif(btrim(codigo_interno), '') IS NULL;
    SELECT count(*) INTO nao_numerico FROM produtos
     WHERE empresa_id = 1 AND nullif(btrim(codigo_interno), '') IS NOT NULL
       AND btrim(codigo_interno) !~ '^[0-9]+$';
    -- Códigos não numéricos não abortam: a renumeração cobre TODOS os produtos da
    -- empresa (não numéricos e sem código vão para o fim da sequência, por id) e o
    -- dono confirmou que o cliente não depende dos códigos internos atuais.
    IF nao_numerico > 0 THEN
        RAISE NOTICE '% código(s) não numérico(s) serão substituídos pela sequência.', nao_numerico;
    END IF;
    SELECT count(*) INTO conflito_barras
      FROM produtos p JOIN produtos b ON b.empresa_id = p.empresa_id
        AND b.codigo_barras = p.codigo_interno AND b.id <> p.id
     WHERE p.empresa_id = 1 AND p.codigo_interno ~ '^[0-9]{13}$';
    IF conflito_barras > 0 THEN
        RAISE EXCEPTION 'EAN do código interno já existe como barcode de outro produto; abortado.';
    END IF;
    SELECT count(*) INTO ean_duplicado FROM (
        SELECT codigo_barras FROM produtos
         WHERE empresa_id = 1 AND codigo_barras IS NOT NULL
         GROUP BY codigo_barras HAVING count(*) > 1) d;
    IF ean_duplicado > 0 THEN
        RAISE EXCEPTION 'Códigos de barras duplicados na empresa; abortado.';
    END IF;
END $$;

-- 1) Mover EAN de 13 dígitos que está no código interno para o código de barras
--    (somente onde o barcode está vazio).
UPDATE produtos
   SET codigo_barras = codigo_interno
 WHERE empresa_id = 1
   AND codigo_interno ~ '^[0-9]{13}$'
   AND codigo_barras IS NULL;

-- 1b) Limpar barcode vazado: valor igual ao próprio código interno (não é EAN real;
--     ex.: código automático inflado copiado no campo de código de barras).
UPDATE produtos
   SET codigo_barras = NULL
 WHERE empresa_id = 1
   AND codigo_barras = codigo_interno
   AND codigo_interno ~ '^[0-9]{13}$';

-- 2) Renumerar sequencial 1..N (menor código atual → maior; sem código numérico
--    e códigos não numéricos por último, por id).
CREATE TEMP TABLE renumeracao ON COMMIT DROP AS
SELECT p.id,
       row_number() OVER (
           ORDER BY CASE WHEN btrim(p.codigo_interno) ~ '^[0-9]+$'
                         THEN btrim(p.codigo_interno)::numeric END NULLS LAST,
                    p.id
       )::bigint AS novo_codigo
  FROM produtos p
 WHERE p.empresa_id = 1;

UPDATE produtos p
   SET codigo_interno = r.novo_codigo::text
  FROM renumeracao r
 WHERE p.id = r.id
   AND p.codigo_interno IS DISTINCT FROM r.novo_codigo::text;

-- 3) Numerador = último código da sequência (próximo automático sai N+1).
UPDATE produto_codigo_numeradores
   SET ultimo_codigo = (SELECT max(novo_codigo) FROM renumeracao)
 WHERE empresa_id = 1;

DROP TABLE renumeracao;

COMMIT;

-- PÓS-VALIDAÇÃO (READ-ONLY)
SELECT count(*) AS total, count(DISTINCT codigo_interno) AS distintos,
       min(codigo_interno::numeric) AS menor, max(codigo_interno::numeric) AS maior
  FROM produtos WHERE empresa_id = 1 AND codigo_interno ~ '^[0-9]+$';
-- Contiguidade: faixa deve ser igual ao total (sem buracos).
SELECT (max(codigo_interno::numeric) - min(codigo_interno::numeric) + 1) AS faixa, count(*) AS total
  FROM produtos WHERE empresa_id = 1 AND codigo_interno ~ '^[0-9]+$';
SELECT ultimo_codigo AS numerador_depois FROM produto_codigo_numeradores WHERE empresa_id = 1;
SELECT count(*) AS produtos_sem_codigo FROM produtos WHERE empresa_id = 1 AND nullif(btrim(codigo_interno),'') IS NULL;
SELECT id, nome, codigo_interno, codigo_barras FROM produtos
 WHERE empresa_id = 1 AND codigo_interno ~ '^[0-9]{13}$';  -- deve voltar vazio
