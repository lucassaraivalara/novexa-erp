"""Diagnóstico READ-ONLY: compara planilha Mustache com produção e mapeia o estado dos códigos.

Não grava nada. Credenciais capturadas em memória via SSH (mesmo contrato do carga_inicial_produtos).
"""
import json
import os
import re
import subprocess
from urllib.parse import urlsplit, parse_qs

import psycopg
from psycopg.rows import dict_row
import xlrd

PLANILHA = r"C:\Users\lucas\Downloads\Lista Produtos Mustache Certo.xls"
NOME, CODIGO, CUSTO, EAN = 3, 4, 10, 44


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
                           connect_timeout=10, row_factory=dict_row, autocommit=True)


def norm(v):
    if v is None:
        return ''
    if isinstance(v, float):
        v = str(int(v)) if v == int(v) else str(v)
    return str(v).strip()


def main():
    book = xlrd.open_workbook(PLANILHA, on_demand=True)
    sheet = book.sheet_by_index(0)
    linhas = []
    for r in range(1, sheet.nrows):
        nome = norm(sheet.cell_value(r, NOME))
        if not nome:
            continue
        codigo = norm(sheet.cell_value(r, CODIGO)).upper()
        ean = re.sub(r'\s', '', norm(sheet.cell_value(r, EAN)))
        custo = norm(sheet.cell_value(r, CUSTO))
        linhas.append({'linha': r + 1, 'nome': nome, 'codigo': codigo, 'ean': ean, 'custo': custo})
    book.release_resources()
    print(f"PLANILHA: {len(linhas)} produtos | com EAN: {sum(1 for l in linhas if l['ean'])}")

    with producao() as conn:
        conn.execute('SET TRANSACTION READ ONLY') if False else None
        empresas = conn.execute('SELECT id, nome_fantasia FROM empresas ORDER BY id').fetchall()
        print('EMPRESAS:', [(e['id'], e['nome_fantasia']) for e in empresas])
        for e in empresas:
            c = conn.execute('SELECT count(*) n FROM produtos WHERE empresa_id=%s', (e['id'],)).fetchone()['n']
            print(f"  empresa {e['id']} ({e['nome_fantasia']}): {c} produtos")

        # tenant principal = o que tem ~537 produtos
        principal = conn.execute('SELECT empresa_id, count(*) n FROM produtos GROUP BY 1 ORDER BY 2 DESC LIMIT 1').fetchone()
        empresa = principal['empresa_id']
        print(f"\nTENANT PRINCIPAL: {empresa} com {principal['n']} produtos")
        prods = conn.execute('SELECT id, nome, codigo_interno, codigo_barras, preco_custo, ativo '
                             'FROM produtos WHERE empresa_id=%s ORDER BY id', (empresa,)).fetchall()
        numerador = conn.execute('SELECT ultimo_codigo FROM produto_codigo_numeradores WHERE empresa_id=%s',
                                 (empresa,)).fetchone()
        print('NUMERADOR ATUAL:', numerador['ultimo_codigo'] if numerador else None)

    por_codigo = {norm(p['codigo_interno']).upper(): p for p in prods if p['codigo_interno']}
    por_ean = {norm(p['codigo_barras']): p for p in prods if p['codigo_barras']}
    por_nome = {re.sub(r'\s+', ' ', norm(p['nome']).lower()): p for p in prods}
    achados_codigo = achados_ean = achados_nome = 0
    faltantes = []
    for l in linhas:
        alvo = None
        if l['codigo'] and l['codigo'].upper() in por_codigo:
            alvo = por_codigo[l['codigo'].upper()]; achados_codigo += 1
        elif l['ean'] and l['ean'] in por_ean:
            alvo = por_ean[l['ean']]; achados_ean += 1
        elif re.sub(r'\s+', ' ', l['nome'].lower()) in por_nome:
            alvo = por_nome[re.sub(r'\s+', ' ', l['nome'].lower())]; achados_nome += 1
        if alvo is None:
            faltantes.append(l)
    print(f"\nMATCH: por codigo {achados_codigo} | por EAN {achados_ean} | por nome {achados_nome}")
    print(f"FALTANTES: {len(faltantes)}")
    for f in faltantes:
        print(f"  linha {f['linha']}: {f['nome'][:60]} | cod={f['codigo']} ean={f['ean']} custo={f['custo']}")

    formas = {}
    ean13_em_interno = 0
    for p in prods:
        c = norm(p['codigo_interno'])
        formas[len(c)] = formas.get(len(c), 0) + 1
        if re.fullmatch(r'\d{13}', c):
            ean13_em_interno += 1
    print(f"\nFORMAS DO CODIGO INTERNO (tamanho: qtd): {dict(sorted(formas.items()))}")
    print(f"codigo_interno com 13 digitos (EAN?): {ean13_em_interno}")
    com_ean_barras = sum(1 for p in prods if norm(p['codigo_barras']))
    print(f"codigo_barras preenchido: {com_ean_barras} de {len(prods)}")
    print(f"preco_custo > 0: {sum(1 for p in prods if p['preco_custo'] and float(p['preco_custo']) > 0)}")


if __name__ == '__main__':
    main()
