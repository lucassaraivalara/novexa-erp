"""Diagnóstico READ-ONLY: investiga erro "Composição alterada ou componente indisponível"
no faturamento de venda com Kit/Combo (produto Maço Palheiro Cristal).

Não grava nada: SELECT apenas, com default_transaction_read_only=on.
Mesmo contrato de conexão do diagnostico_mustache.py (SSH -> env -> psycopg).
"""
import json
import os
import subprocess
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
    sslmode = params.get('sslmode', ['require'])[0]
    assert sslmode in ('require', 'verify-ca', 'verify-full')
    return psycopg.connect(host=url.hostname, port=url.port or 5432, dbname='postgres',
                           user=env['DB_USERNAME'], password=env['DB_PASSWORD'], sslmode=sslmode,
                           connect_timeout=10, row_factory=dict_row, autocommit=True,
                           options='-c default_transaction_read_only=on')


def mostrar(titulo, linhas):
    print(f"\n=== {titulo} ===")
    for linha in linhas:
        print(json.dumps(linha, ensure_ascii=False, default=str))


def main():
    with producao() as conn:
        # 1. Produto envolvido e similares (pode haver grafia variada).
        produtos = conn.execute("""
            SELECT id, empresa_id, codigo_interno, codigo_barras, nome, ativo, composto,
                   controla_estoque, composicao_versao, estoque_atual, unidade_medida, preco_venda
            FROM produtos
            WHERE nome ILIKE '%palheiro%'
            ORDER BY empresa_id, nome
        """).fetchall()
        mostrar("Produtos 'palheiro'", produtos)

        # 2. Todos os kits da base com a versão atual.
        kits = conn.execute("""
            SELECT id, empresa_id, nome, ativo, composto, controla_estoque, composicao_versao
            FROM produtos
            WHERE composto = true
            ORDER BY empresa_id, nome
        """).fetchall()
        mostrar("Kits/Combos cadastrados", kits)

        # 3. Composição (versão vigente) de cada kit + estado de cada componente.
        for kit in kits:
            comp = conn.execute("""
                SELECT cp.id, cp.versao, cp.componente_id, cp.nome_componente, cp.quantidade,
                       cp.fator, cp.unidade AS unidade_venda, cp.unidade_estoque,
                       p.nome AS nome_atual_componente, p.ativo, p.composto AS componente_e_kit,
                       p.controla_estoque, p.estoque_atual, p.unidade_medida,
                       (cp.versao = k.composicao_versao) AS versao_vigente
                FROM componentes_produto cp
                JOIN produtos k ON k.id = cp.produto_id
                JOIN produtos p ON p.id = cp.componente_id
                WHERE cp.produto_id = %s
                ORDER BY cp.versao DESC, cp.id
            """, (kit['id'],)).fetchall()
            mostrar(f"Composição do kit #{kit['id']} {kit['nome']} (empresa {kit['empresa_id']})", comp)

        # 4. Vendas ABERTA contendo kits (rascunho que falhou no faturamento).
        vendas = conn.execute("""
            SELECT v.id, v.empresa_id, v.status, v.total, v.data_hora,
                   iv.produto_id, p.nome AS produto, p.composto, iv.quantidade,
                   iv.composicao_versao AS versao_no_item, p.composicao_versao AS versao_atual_produto
            FROM vendas v
            JOIN itens_venda iv ON iv.venda_id = v.id
            JOIN produtos p ON p.id = iv.produto_id
            WHERE v.status = 'ABERTA' AND p.composto = true
            ORDER BY v.id DESC
            LIMIT 50
        """).fetchall()
        mostrar("Itens de kit em vendas ABERTA", vendas)

        # 5. Componentes com problemas em qualquer versão vigente (diagnóstico amplo).
        problemas = conn.execute("""
            SELECT DISTINCT k.id AS kit_id, k.nome AS kit, k.empresa_id,
                   p.id AS componente_id, p.nome AS componente,
                   p.ativo, p.composto AS componente_e_kit, p.controla_estoque, p.estoque_atual
            FROM componentes_produto cp
            JOIN produtos k ON k.id = cp.produto_id
            JOIN produtos p ON p.id = cp.componente_id
            WHERE cp.versao = k.composicao_versao
              AND (p.ativo = false OR p.composto = true OR p.controla_estoque = false)
            ORDER BY k.empresa_id, k.nome
        """).fetchall()
        mostrar("Componentes IRREGULARES em composições vigentes", problemas)

    print("\nNENHUM DADO FOI ALTERADO (transações somente leitura).")


if __name__ == '__main__':
    main()
