"""Testes do procedimento operacional; somente PostgreSQL descartável configurado pelo operador."""
import copy
import os
import unittest
import psycopg
from psycopg.rows import dict_row
from carga_inicial_produtos import validar, planejar, gravar, snapshot, Bloqueio


def linha(numero=1, **campos):
    data=dict(linha=numero,erros=[],nome='Produto sintético',codigo_interno='NOVO',codigo_barras='',
              preco_venda='12.50',unidade_medida='UN',estoque_minimo='0',ativo='Ativo',
              categoria='Categoria sintética',subcategoria='Sub sintética',marca='Marca sintética',
              fornecedor='Fornecedor sintético',ncm='12345678 Descrição explícita',cest='')
    data.update(campos)
    return data


class ValidacaoTest(unittest.TestCase):
    def test_obrigatorios_e_precisao_sem_inferir(self):
        r=linha(unidade_medida='',preco_venda='',cest='302100')
        validar(r)
        self.assertEqual({f for f,_ in r['erros']},{'unidade_medida','preco_venda','cest'})
        self.assertEqual(r['ncm'],'12345678')


@unittest.skipUnless(os.environ.get('NOVEXA_CARGA_DSN'), 'Exige banco descartável explícito')
class PostgreSQLTest(unittest.TestCase):
    def setUp(self):
        self.conn=psycopg.connect(os.environ['NOVEXA_CARGA_DSN'],row_factory=dict_row)
        if self.conn.execute('select current_schema() as schema').fetchone()['schema']!='carga_operacional_test':
            raise RuntimeError('Teste permitido somente no schema descartável esperado')
        self.before=snapshot(self.conn,900001)
    def tearDown(self):
        self.conn.rollback()
        self.assertEqual(snapshot(self.conn,900001),self.before)
        self.conn.close()
    def test_vinculos_estoque_zero_repeticao_sem_duplicar(self):
        rows=[linha()]
        _,indexes=planejar(self.conn,rows,900001)
        ids,created=gravar(self.conn,rows,900001,indexes)
        self.assertEqual(len(ids),1)
        self.assertEqual(created,dict(categoria=1,subcategoria=1,marca=1,fornecedor=1))
        p=self.conn.execute('select * from produtos where id=%s',(ids[0],)).fetchone()
        self.assertEqual(p['estoque_atual'],0)
        self.assertEqual(p['preco_custo'],0)
        self.assertTrue(all(p[f] for f in ('categoria_id','subcategoria_id','marca_id','fornecedor_principal_id')))
        self.assertEqual(snapshot(self.conn,900001)['movimentos'],self.before['movimentos'])
        repeat=[linha()]
        _,indexes=planejar(self.conn,repeat,900001)
        self.assertEqual(repeat[0]['situacao'],'DUPLICADA')
        self.assertEqual(gravar(self.conn,repeat,900001,indexes)[0],[])
    def test_duplicidade_no_arquivo_rejeita_todas_ocorrencias(self):
        rows=[linha(),linha(2)]
        planejar(self.conn,rows,900001)
        self.assertEqual([r['situacao'] for r in rows],['DUPLICADA','DUPLICADA'])
    def test_reusa_nomes_sem_caixa_espacos_e_rejeita_ambiguidade(self):
        self.conn.execute("insert into fornecedores(empresa_id,razao_social,ativo,data_cadastro) values (900001,' fornecedor sintético ',true,current_timestamp)")
        rows=[linha()]
        _,indexes=planejar(self.conn,rows,900001)
        ids,created=gravar(self.conn,rows,900001,indexes)
        self.assertNotIn('fornecedor',created)
        self.conn.execute("insert into fornecedores(empresa_id,razao_social,ativo,data_cadastro) values (900001,'Fornecedor Sintético',true,current_timestamp)")
        with self.assertRaises(Bloqueio): planejar(self.conn,[linha()],900001)
    def test_outra_empresa_nao_e_vinculada(self):
        self.conn.execute("insert into empresas(id,razao_social,ativo) values (900002,'Outra sintética',true)")
        self.conn.execute("insert into marcas(empresa_id,nome,ativo) values (900002,'Marca sintética',true)")
        rows=[linha()]
        _,indexes=planejar(self.conn,rows,900001)
        ids,_=gravar(self.conn,rows,900001,indexes)
        p=self.conn.execute('select m.empresa_id from produtos p join marcas m on m.id=p.marca_id where p.id=%s',(ids[0],)).fetchone()
        self.assertEqual(p['empresa_id'],900001)
    def test_subcategoria_em_categoria_errada_bloqueia(self):
        c=self.conn.execute("insert into categorias_produtos(empresa_id,nome,ativo) values (900001,'Outra categoria',true) returning id").fetchone()
        self.conn.execute("insert into subcategorias_produtos(empresa_id,categoria_id,nome,ativo) values (900001,%s,'Sub sintética',true)",(c['id'],))
        with self.assertRaises(Bloqueio): planejar(self.conn,[linha()],900001)
    def test_falha_no_meio_reverte_todo_lote(self):
        rows=[linha(),linha(2,codigo_interno='NOVO2')]
        _,indexes=planejar(self.conn,rows,900001)
        rows[1]['nome']=None
        with self.assertRaises(psycopg.errors.NotNullViolation): gravar(self.conn,rows,900001,indexes)
        self.conn.rollback()
        self.assertEqual(snapshot(self.conn,900001),self.before)


if __name__=='__main__': unittest.main()
