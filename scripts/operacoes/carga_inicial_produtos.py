"""Carga operacional única Mustache. Sem API; preview read-only e rollback por padrão.

Dependências isoladas: xlrd==2.0.2, psycopg[binary]==3.3.6.
Credenciais somente em memória: NOVEXA_CARGA_DSN (descartável) ou env externo da VM.
CPF do ADMIN em NOVEXA_CARGA_CPF; nunca registrar seu valor.
"""
import argparse
import collections
import csv
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from decimal import Decimal, InvalidOperation
from urllib.parse import urlsplit, parse_qs

import psycopg
from psycopg.rows import dict_row
from psycopg import sql
import xlrd


class Bloqueio(Exception):
    pass


def chave(value):
    return str(value or '').strip().lower()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()


def conexao(args):
    if not args.production:
        return psycopg.connect(os.environ['NOVEXA_CARGA_DSN'], row_factory=dict_row)
    # Captura em memória, sem imprimir env, URI, usuário ou senha.
    remote = "sudo -n python3 -c \"import json,pathlib; print(json.dumps(dict(x.split('=',1) for x in pathlib.Path('/etc/novexa/novexa-api.env').read_text().splitlines() if '=' in x and not x.lstrip().startswith('#'))))\""
    result = subprocess.run(['ssh', '-i', os.environ['NOVEXA_SSH_KEY'], '-o', 'BatchMode=yes',
                             '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15',
                             'ubuntu@163.176.231.214', remote], capture_output=True, check=True, text=True)
    env = json.loads(result.stdout)
    url = urlsplit(env['DB_URL'].removeprefix('jdbc:'))
    params = parse_qs(url.query)
    if url.scheme != 'postgresql' or url.path != '/postgres' or params.get('currentSchema', ['public']) != ['public']:
        raise Bloqueio('Banco/schema JDBC diferente do esperado; nenhuma gravação.')
    sslmode = params.get('sslmode', ['require' if params.get('ssl') == ['true'] else ''])[0]
    if sslmode not in ('require', 'verify-ca', 'verify-full'):
        raise Bloqueio('TLS PostgreSQL não confirmado; nenhuma gravação.')
    return psycopg.connect(host=url.hostname, port=url.port or 5432, dbname='postgres',
                           user=env['DB_USERNAME'], password=env['DB_PASSWORD'], sslmode=sslmode,
                           connect_timeout=10, row_factory=dict_row)


def ler(arquivo):
    book = xlrd.open_workbook(arquivo, on_demand=True, formatting_info=True)
    if book.nsheets != 1:
        raise Bloqueio('Esperada uma aba.')
    sheet = book.sheet_by_index(0)
    headers = {str(sheet.cell_value(0, c)).strip(): c for c in range(sheet.ncols)}
    campos = {'Nome': 'nome', 'Código': 'codigo_interno', 'EAN / GTIN': 'codigo_barras',
              'Preço': 'preco_venda', 'Unidade': 'unidade_medida', 'Estoque Min.': 'estoque_minimo',
              'Status': 'ativo', 'Categoria': 'categoria', 'Sub Categoria': 'subcategoria',
              'Marca': 'marca', 'Fornecedor Principal': 'fornecedor', 'NCM': 'ncm', 'CEST': 'cest'}
    if not {'Nome', 'Preço', 'Unidade'} <= headers.keys():
        raise Bloqueio('Cabeçalhos obrigatórios ausentes.')
    rows = []
    for r in range(1, sheet.nrows):
        row = {'linha': r + 1, 'erros': []}
        for title, field in campos.items():
            cell = sheet.cell(r, headers[title]) if title in headers else None
            value = '' if cell is None else cell.value
            if cell is not None and cell.ctype == xlrd.XL_CELL_ERROR:
                row['erros'].append((field, 'Erro Excel.'))
            if isinstance(value, float) and field not in ('preco_venda', 'estoque_minimo'):
                if value != int(value) or abs(value) >= 10**15:
                    row['erros'].append((field, 'Identificador numérico sem precisão segura.'))
                value = str(int(value)) if value == int(value) else str(value)
                fmt = book.format_map[book.xf_list[cell.xf_index].format_key].format_str if book.formatting_info else ''
                if re.fullmatch('0+', fmt):
                    value = value.zfill(len(fmt))
            row[field] = str(value).strip()
        rows.append(row)
    book.release_resources()
    return rows


def validar(row):
    errors = row['erros']
    for field, limit in [('nome', 150), ('codigo_interno', 60), ('codigo_barras', 60), ('unidade_medida', 10)]:
        if (field in ('nome', 'unidade_medida') and not row[field]) or len(row[field]) > limit:
            errors.append((field, 'Obrigatório ou tamanho inválido.'))
    row['codigo_interno'] = row['codigo_interno'].upper() or None
    row['codigo_barras'] = re.sub(r'\s', '', row['codigo_barras']) or None
    row['unidade_medida'] = row['unidade_medida'].upper()
    for field, scale, required in [('preco_venda', 2, True), ('estoque_minimo', 3, False)]:
        raw = row[field].replace('R$', '').replace(' ', '')
        if not raw and not required:
            raw = '0'
        if ',' in raw:
            raw = raw.replace('.', '').replace(',', '.')
        try:
            value = Decimal(raw)
            if not value.is_finite() or value < 0 or value != value.quantize(Decimal(10)**-scale) or value >= Decimal(10)**(19-scale):
                raise InvalidOperation
            row[field] = value
        except InvalidOperation:
            errors.append((field, 'Valor obrigatório, não negativo e com precisão válida.'))
    for field, length in [('ncm', 8), ('cest', 7)]:
        raw = row[field]
        if field == 'ncm':
            # O exportador inclui código explícito seguido de descrição; não inferir códigos.
            original = re.fullmatch(r'(\d{8})\s+\S.*', raw)
            if original: raw = original.group(1)
        row[field] = raw.replace('.', '').replace(' ', '') or None
        if row[field] and not re.fullmatch(r'\d{' + str(length) + '}', row[field]):
            errors.append((field, f'Exige {length} dígitos; não completar zeros por suposição.'))
    status = chave(row['ativo'])
    if status not in ('', 'ativo', 'ativa', 'sim', 'true', '1', 'inativo', 'inativa', 'não', 'nao', 'false', '0'):
        errors.append(('ativo', 'Status desconhecido.'))
    row['ativo'] = status not in ('inativo', 'inativa', 'não', 'nao', 'false', '0')
    for field in ('categoria', 'subcategoria', 'marca', 'fornecedor'):
        if len(row[field]) > (150 if field == 'fornecedor' else 100):
            errors.append((field, 'Nome excede limite cadastral.'))
    if row['subcategoria'] and not row['categoria']:
        errors.append(('subcategoria', 'Categoria obrigatória para a subcategoria.'))


TABLES = {'categoria': 'categorias_produtos', 'subcategoria': 'subcategorias_produtos',
          'marca': 'marcas', 'fornecedor': 'fornecedores'}


def snapshot(conn, empresa):
    products = conn.execute('SELECT id, md5(row_to_json(p)::text) AS hash FROM produtos p WHERE empresa_id=%s ORDER BY id', (empresa,)).fetchall()
    stock = conn.execute('SELECT count(*) AS quantidade, coalesce(sum(estoque_atual),0) AS saldo FROM produtos WHERE empresa_id=%s', (empresa,)).fetchone()
    movements = conn.execute('SELECT count(*) AS quantidade, coalesce(max(id),0) AS ultimo FROM movimentacoes_estoque WHERE empresa_id=%s', (empresa,)).fetchone()
    return {'produtos': products, 'estoque': stock, 'movimentos': movements}


def planejar(conn, rows, empresa):
    refs = {}
    for field, table in TABLES.items():
        columns = 'id,razao_social,nome_fantasia' if field == 'fornecedor' else 'id,nome' + (',categoria_id' if field == 'subcategoria' else '')
        refs[field] = conn.execute(sql.SQL('SELECT '+columns+' FROM {} WHERE empresa_id=%s ORDER BY id').format(sql.Identifier(table)), (empresa,)).fetchall()
    indexes = {field: collections.defaultdict(list) for field in TABLES}
    for field, records in refs.items():
        for record in records:
            names = (record['razao_social'], record['nome_fantasia']) if field == 'fornecedor' else (record['nome'],)
            for name in {chave(n) for n in names if chave(n)}:
                indexes[field][name].append(record)
    seen_sub = {}
    for row in rows:
        if not row['nome'] and not any(row[f] for f in ('codigo_interno','codigo_barras','preco_venda','unidade_medida')):
            row['situacao'] = 'IGNORADA'
            continue
        validar(row)
        for field in TABLES:
            matches = indexes[field].get(chave(row[field]), [])
            if len(matches) > 1:
                raise Bloqueio(f'Referência ambígua: {field}, linha {row["linha"]}; nenhuma gravação.')
        if row['subcategoria']:
            sub, cat = chave(row['subcategoria']), chave(row['categoria'])
            if sub in seen_sub and seen_sub[sub] != cat:
                raise Bloqueio('Subcategoria usada em categorias diferentes no arquivo.')
            seen_sub[sub] = cat
            existing = indexes['subcategoria'].get(sub, [])
            category = indexes['categoria'].get(cat, [])
            if existing and (not category or existing[0]['categoria_id'] != category[0]['id']):
                raise Bloqueio(f'Subcategoria incompatível com a categoria, linha {row["linha"]}.')
    codes = collections.Counter(row['codigo_interno'] for row in rows if row.get('situacao') != 'IGNORADA' and row['codigo_interno'])
    eans = collections.Counter(row['codigo_barras'] for row in rows if row.get('situacao') != 'IGNORADA' and row['codigo_barras'])
    existing = conn.execute('SELECT codigo_interno,codigo_barras FROM produtos WHERE empresa_id=%s', (empresa,)).fetchall()
    oldcodes = {chave(p['codigo_interno']) for p in existing if p['codigo_interno']}
    oldeans = {chave(p['codigo_barras']) for p in existing if p['codigo_barras']}
    for row in rows:
        if row.get('situacao') == 'IGNORADA': continue
        if row['erros']: row['situacao'] = 'REJEITADA'
        elif ((row['codigo_interno'] and (codes[row['codigo_interno']] > 1 or chave(row['codigo_interno']) in oldcodes)) or
              (row['codigo_barras'] and (eans[row['codigo_barras']] > 1 or chave(row['codigo_barras']) in oldeans))):
            row['situacao'] = 'DUPLICADA'
            row['erros'].append(('codigo/EAN', 'Já existe na empresa ou está repetido no arquivo; não atualizar.'))
        else: row['situacao'] = 'VALIDA'
    return refs, indexes


def gravar(conn, rows, empresa, indexes):
    created = collections.Counter()
    ids = []
    for row in rows:
        if row['situacao'] != 'VALIDA': continue
        linked = {}
        for field, table in TABLES.items():
            name = row[field]
            if not name:
                linked[field] = None
                continue
            key = chave(name)
            if key not in indexes[field]:
                if field == 'fornecedor':
                    record = conn.execute('INSERT INTO fornecedores(empresa_id,razao_social,ativo,data_cadastro,data_atualizacao) VALUES (%s,%s,true,current_timestamp,current_timestamp) RETURNING id', (empresa,name)).fetchone()
                elif field == 'subcategoria':
                    record = conn.execute('INSERT INTO subcategorias_produtos(empresa_id,categoria_id,nome,ativo) VALUES (%s,%s,%s,true) RETURNING id', (empresa,linked['categoria'],name)).fetchone()
                else:
                    record = conn.execute(sql.SQL('INSERT INTO {}(empresa_id,nome,ativo) VALUES (%s,%s,true) RETURNING id').format(sql.Identifier(table)), (empresa,name)).fetchone()
                indexes[field][key] = [record]
                created[field] += 1
            linked[field] = indexes[field][key][0]['id']
        record = conn.execute('''INSERT INTO produtos(empresa_id,nome,codigo_interno,codigo_barras,preco_venda,unidade_medida,
             estoque_minimo,ativo,categoria_id,subcategoria_id,marca_id,fornecedor_principal_id,ncm,cest,
             estoque_atual,preco_custo,controla_estoque,data_cadastro)
             VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,0,true,current_timestamp) RETURNING id''',
             (empresa,row['nome'],row['codigo_interno'],row['codigo_barras'],row['preco_venda'],row['unidade_medida'],
              row['estoque_minimo'],row['ativo'],linked['categoria'],linked['subcategoria'],linked['marca'],linked['fornecedor'],row['ncm'],row['cest'])).fetchone()
        ids.append(record['id'])
    return ids, dict(created)


def executar(args):
    report = Path(args.report_dir).resolve()
    repo = Path(__file__).resolve().parents[2]
    if report.is_relative_to(repo): raise Bloqueio('Relatórios devem ficar fora do repositório.')
    report.mkdir(parents=True,exist_ok=True)
    rows = ler(args.arquivo)
    if sum(bool(r['nome']) for r in rows) != args.expected_rows:
        raise Bloqueio('Quantidade de produtos preenchidos difere da quantidade esperada.')
    with conexao(args) as conn:
        if args.mode == 'preview': conn.execute('SET TRANSACTION READ ONLY')
        conn.execute("SET LOCAL lock_timeout='10s'")
        conn.execute("SET LOCAL statement_timeout='120s'")
        identity = conn.execute('SELECT current_database() AS banco,current_schema() AS schema').fetchone()
        if args.production and identity != {'banco':'postgres','schema':'public'}:
            raise Bloqueio('Banco/schema de produção não confirmado.')
        if not conn.execute("SELECT 1 FROM flyway_schema_history WHERE version='42' AND success").fetchone():
            raise Bloqueio('V42 aplicada não confirmada.')
        cpf = re.sub(r'\D','',os.environ['NOVEXA_CARGA_CPF'])
        users = conn.execute("SELECT u.id,u.empresa_id,e.ativo AS empresa_ativa FROM usuario u JOIN empresas e ON e.id=u.empresa_id WHERE regexp_replace(u.cpf,'[^0-9]','','g')=%s AND u.ativo AND u.perfil='ADMIN'", (cpf,)).fetchall()
        if len(users) != 1 or not users[0]['empresa_ativa']:
            raise Bloqueio('ADMIN/empresa ativa não identificados inequivocamente.')
        empresa = users[0]['empresa_id']
        if args.empresa_id and empresa != args.empresa_id: raise Bloqueio('Empresa diverge da prévia aprovada.')
        if args.mode != 'preview':
            conn.execute('LOCK TABLE produtos,categorias_produtos,subcategorias_produtos,marcas,fornecedores IN SHARE ROW EXCLUSIVE MODE')
        before = snapshot(conn,empresa)
        refs,indexes = planejar(conn,rows,empresa)
        counts = collections.Counter(r['situacao'] for r in rows)
        preview_sha = digest({'arquivo':hashlib.sha256(Path(args.arquivo).read_bytes()).hexdigest(), 'empresa':empresa,'before':before,'refs':refs,'rows':rows})
        summary = {'modo':args.mode,'empresa_id':empresa,'linhas':len(rows),'preenchidas':args.expected_rows,
                   'validas':counts['VALIDA'],'rejeitadas':counts['REJEITADA'],'duplicadas':counts['DUPLICADA'],
                   'ignoradas':counts['IGNORADA'],'inseridos':0,'preview_sha':preview_sha,
                   'antes':before['estoque'],'movimentos_antes':before['movimentos']}
        if args.mode == 'apply' and (not args.backup_confirmado or not args.empresa_id or args.preview_sha != preview_sha):
            raise Bloqueio('Backup/empresa/hash da prévia não confirmados ou catálogo alterado.')
        with (report/'erros.csv').open('w',encoding='utf-8-sig',newline='') as file:
            writer = csv.writer(file,delimiter=';'); writer.writerow(['linha','produto','campo','motivo'])
            for row in rows:
                for field,message in row['erros']:
                    # Neutraliza fórmulas no relatório, sem alterar a planilha fonte.
                    name = row['nome']; name = "'"+name if name.lstrip().startswith(('=','+','-','@')) else name
                    writer.writerow([row['linha'],name,field,message])
        if args.mode != 'preview':
            ids,created = gravar(conn,rows,empresa,indexes)
            after = snapshot(conn,empresa)
            oldids = {p['id'] for p in before['produtos']}
            if [p for p in after['produtos'] if p['id'] in oldids] != before['produtos'] or after['movimentos'] != before['movimentos'] or after['estoque']['saldo'] != before['estoque']['saldo']:
                raise Bloqueio('Invariante de produtos existentes/estoque/movimentos violada; rollback.')
            invalid = conn.execute('''SELECT count(*) AS quantidade FROM produtos p
                 LEFT JOIN categorias_produtos c ON c.id=p.categoria_id
                 LEFT JOIN subcategorias_produtos s ON s.id=p.subcategoria_id
                 LEFT JOIN marcas m ON m.id=p.marca_id
                 LEFT JOIN fornecedores f ON f.id=p.fornecedor_principal_id
                 WHERE p.id=ANY(%s) AND (p.empresa_id<>%s OR p.estoque_atual<>0 OR p.preco_custo<>0
                 OR c.empresa_id<>p.empresa_id OR s.empresa_id<>p.empresa_id OR m.empresa_id<>p.empresa_id OR f.empresa_id<>p.empresa_id
                 OR s.categoria_id<>p.categoria_id)''',(ids,empresa)).fetchone()['quantidade']
            if invalid or len(ids)!=counts['VALIDA'] or after['estoque']['quantidade']-before['estoque']['quantidade']!=len(ids):
                raise Bloqueio('Contagem/relacionamentos divergentes; rollback.')
            summary.update({'inseridos':len(ids),'cadastros_criados':created,'produto_ids':ids,'depois':after['estoque'],'movimentos_depois':after['movimentos']})
        if args.mode == 'apply':
            conn.commit(); summary['resultado']='COMMIT'
        else:
            conn.rollback(); summary['resultado']='ROLLBACK' if args.mode=='rehearse' else 'SEM_GRAVACAO'
        (report/(args.mode+'-resumo.json')).write_text(json.dumps(summary,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
        print(json.dumps({k:v for k,v in summary.items() if k!='produto_ids'},ensure_ascii=False,default=str))
        return summary


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('arquivo')
    parser.add_argument('--mode',choices=['preview','rehearse','apply'],default='preview')
    parser.add_argument('--production',action='store_true')
    parser.add_argument('--empresa-id',type=int)
    parser.add_argument('--preview-sha')
    parser.add_argument('--backup-confirmado',action='store_true')
    parser.add_argument('--expected-rows',type=int,default=606)
    parser.add_argument('--report-dir',required=True)
    args=parser.parse_args()
    try: executar(args)
    except Bloqueio as exc: print('BLOQUEIO:',exc); raise SystemExit(2)
    except Exception as exc:
        # Exceções de conexão/SQL podem conter secrets ou dados pessoais.
        print('FALHA:',type(exc).__name__,'SQLSTATE:',getattr(exc,'sqlstate',None),'Transação não confirmada.'); raise SystemExit(3)
