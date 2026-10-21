import json, subprocess, sys, os
from urllib.parse import urlparse, parse_qs

SSH = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'StrictHostKeyChecking=yes',
       '-i', r'C:\Users\lucas\Downloads\ssh-key-2026-10-09 (3).key', 'ubuntu@163.176.231.214']

try:
    result = subprocess.run(SSH + ['sudo cat /etc/novexa/novexa-api.env'], capture_output=True, text=True, encoding='utf-8', check=True)
    env = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line and not line.startswith('#'))
    parsed = urlparse(env['DB_URL'].removeprefix('jdbc:'))
    query = parse_qs(parsed.query)
    pg_env = os.environ.copy()
    pg_env.update(PGPASSWORD=env['DB_PASSWORD'], PGSSLMODE=query.get('sslmode',['require'])[0],
        PGCONNECT_TIMEOUT='15', PGCLIENTENCODING='UTF8', PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=10000')
    sql = """
    with e as (select id,ativo from empresas where lower(coalesce(nome_fantasia,'')) like '%mustache%')
    select json_build_object(
      'banco',current_database(),'schema',current_schema(),'somente_leitura',current_setting('transaction_read_only'),
      'agora_brasilia',now() at time zone 'America/Sao_Paulo',
      'empresas',(select json_agg(e) from e),
      'migration',(select version from flyway_schema_history where version is not null order by installed_rank desc limit 1),
      'tipo_coluna',(select data_type from information_schema.columns where table_schema='public' and table_name='vendas' and column_name='data_hora'),
      'recentes',(select json_agg(v) from (select v.id,v.status,v.data_hora,
          (select min(p.data_hora) from pagamentos p where p.venda_id=v.id and p.empresa_id=v.empresa_id) as primeiro_pagamento
          from vendas v where v.empresa_id=(select id from e where ativo) order by v.id desc limit 12) v),
      'contagens',(select json_agg(c) from (select status,count(*) as quantidade,min(data_hora) as primeira,max(data_hora) as ultima
          from vendas where empresa_id=(select id from e where ativo) group by status) c));
    """
    cmd = [r'C:\Program Files\PostgreSQL\18\bin\psql.exe','-X','-q','-t','-A','-v','ON_ERROR_STOP=1',
        '-h',parsed.hostname,'-p',str(parsed.port or 5432),'-U',env['DB_USERNAME'],'-d',parsed.path.lstrip('/'),
        '-c','BEGIN READ ONLY; '+sql+' ROLLBACK;']
    pg = subprocess.run(cmd, env=pg_env,capture_output=True,text=True,encoding='utf-8')
    if pg.returncode:
        print(json.dumps({'falha':'consulta_ou_conexao', 'erro_autenticacao':'authentication failed' in pg.stderr.lower()}))
        sys.exit(1)
    data=json.loads(pg.stdout)
    if len(data['empresas']) != 1 or not data['empresas'][0]['ativo']: raise RuntimeError('empresa_ambigua')
    print(json.dumps(data,ensure_ascii=True))
except Exception as e:
    print(json.dumps({'falha':type(e).__name__, 'sqlstate':getattr(e,'sqlstate',None)}))
    sys.exit(1)
