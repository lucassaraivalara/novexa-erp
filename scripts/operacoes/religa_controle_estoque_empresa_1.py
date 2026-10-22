"""Correção aprovada: religa controla_estoque em todos os produtos da empresa 1
e liga permitir_venda_estoque_negativo na empresa.

Transação única com pré/pós-validação e rollback automático em qualquer divergência.
Escopo estrito: empresa_id = 1; nenhuma outra tabela é tocada.
"""
import json
import os
import subprocess
import sys
from urllib.parse import urlsplit, parse_qs

import psycopg
from psycopg.rows import dict_row


def producao():
    remote = ("sudo -n python3 -c \"import json,pathlib; print(json.dumps(dict(x.split('=',1) for x in "
              "pathlib.Path('/etc/novexa/novexa-api.env').read_text().splitlines() if '=' in x and not "
              "x.lstrip().startswith('#'))))\"")
    result = subprocess.run(['ssh', '-i', os.environ['NOVEXA_SSH_KEY'], '-o', 'BatchMode=yes',
                             '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15',
                             'ubuntu@163.176.231.214', remote], capture_output=True, check=True, text=True)
    env = json.loads(result.stdout)
    url = urlsplit(env['DB_URL'].removeprefix('jdbc:'))
    params = parse_qs(url.query)
    assert url.scheme == 'postgresql' and url.path == '/postgres', 'banco/schema inesperado'
    return psycopg.connect(host=url.hostname, port=url.port or 5432, dbname='postgres',
                           user=env['DB_USERNAME'], password=env['DB_PASSWORD'],
                           sslmode=params.get('sslmode', ['require'])[0],
                           connect_timeout=10, row_factory=dict_row, autocommit=False)


def main():
    conn = producao()
    try:
        with conn.transaction():
            # PRÉ-VALIDAÇÃO
            alvo = conn.execute(
                "SELECT count(*) AS n FROM produtos WHERE empresa_id=1 AND controla_estoque=false"
            ).fetchone()['n']
            empresa = conn.execute(
                "SELECT id, nome_fantasia, permitir_venda_estoque_negativo FROM empresas WHERE id=1"
            ).fetchone()
            print(f"pré: produtos com controle desligado = {alvo}; empresa 1 = {empresa['nome_fantasia']}; "
                  f"venda_negativo atual = {empresa['permitir_venda_estoque_negativo']}")
            if alvo == 0:
                raise RuntimeError('Nenhum produto com controle desligado; abortado sem alteração.')

            # ESCRITA (mesma transação)
            produtos = conn.execute(
                "UPDATE produtos SET controla_estoque=true "
                "WHERE empresa_id=1 AND controla_estoque=false"
            ).rowcount
            empresas = conn.execute(
                "UPDATE empresas SET permitir_venda_estoque_negativo=true WHERE id=1 "
                "AND permitir_venda_estoque_negativo IS DISTINCT FROM true"
            ).rowcount
            print(f"executado: produtos atualizados = {produtos}; empresas atualizadas = {empresas}")
            if produtos != alvo or empresas not in (0, 1):
                raise RuntimeError(f'Divergência de linhas (esperado produtos={alvo}, empresas 0..1); rollback.')

            # PÓS-VALIDAÇÃO (ainda na transação)
            restantes = conn.execute(
                "SELECT count(*) AS n FROM produtos WHERE empresa_id=1 AND controla_estoque=false"
            ).fetchone()['n']
            flag = conn.execute(
                "SELECT permitir_venda_estoque_negativo FROM empresas WHERE id=1"
            ).fetchone()['permitir_venda_estoque_negativo']
            kits_ok = conn.execute(
                "SELECT count(*) AS n FROM componentes_produto cp JOIN produtos k ON k.id=cp.produto_id "
                "JOIN produtos c ON c.id=cp.componente_id "
                "WHERE k.empresa_id=1 AND cp.versao=k.composicao_versao "
                "AND c.ativo AND c.controla_estoque AND NOT c.composto"
            ).fetchone()['n']
            kits_total = conn.execute(
                "SELECT count(*) AS n FROM componentes_produto cp JOIN produtos k ON k.id=cp.produto_id "
                "WHERE k.empresa_id=1 AND cp.versao=k.composicao_versao"
            ).fetchone()['n']
            print(f"pós: desligados restantes = {restantes}; venda_negativo = {flag}; "
                  f"componentes de kit elegíveis = {kits_ok}/{kits_total}")
            if restantes != 0 or not flag or kits_ok != kits_total:
                raise RuntimeError('Pós-validação falhou; rollback.')
        print('COMMIT concluído com sucesso.')
    except Exception as e:
        print(f'ERRO — rollback executado: {e}')
        sys.exit(1)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
