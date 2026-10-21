"""Testes do procedimento operacional; somente PostgreSQL descartável configurado pelo operador."""
import copy
import os
import unittest
import psycopg
from psycopg.rows import dict_row
from carga_inicial_produtos import (validar, planejar, gravar, snapshot, Bloqueio,
                                    resolver_eans, regularizar, KITS, KITS_EXISTENTES, EXCLUIDOS, chave)


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
        self.assertEqual({f for f,_ in r['erros']},{'unidade_medida','preco_venda'})
        self.assertEqual(r['ncm'],'12345678')

    def test_cest_fora_do_padrao_descarta_sem_erro(self):
        r=linha(cest='302100')
        validar(r)
        self.assertEqual([f for f,_ in r['erros']],[])
        self.assertIsNone(r['cest'])
        self.assertTrue(any(f=='cest' for f,_ in r['avisos']))

    def test_unidade_ajustada_declarada_aplica_padrao(self):
        r=linha(nome='Tropeiro',unidade_medida='')
        validar(r)
        self.assertEqual([f for f,_ in r['erros']],[])
        self.assertEqual(r['unidade_medida'],'UN.')
        self.assertTrue(any(f=='unidade_medida' for f,_ in r['avisos']))

    def test_unidade_ajustada_nao_vaza_para_outros(self):
        r=linha(nome='Produto fora da lista',unidade_medida='')
        validar(r)
        self.assertIn('unidade_medida',{f for f,_ in r['erros']})


class RegrasNovasTest(unittest.TestCase):
    def linha_valida(self, numero=1, **campos):
        data = dict(linha=numero, situacao='VALIDA', erros=[], avisos=[], nome=f'Produto {numero}',
                    codigo_interno=str(1000 + numero), codigo_barras='')
        data.update(campos)
        return data

    def test_ean_repetido_kit_tem_prioridade(self):
        unit = self.linha_valida(1, nome='Cigarro Solto X', codigo_barras='7890001')
        kit = self.linha_valida(2, nome='Maço Cigarro X', codigo_barras='7890001')
        KITS[chave('Maço Cigarro X')] = (chave('Cigarro Solto X'), 20)
        try:
            resolver_eans([unit, kit])
        finally:
            del KITS[chave('Maço Cigarro X')]
        self.assertEqual(kit['codigo_barras'], '7890001')
        self.assertIsNone(unit['codigo_barras'])
        self.assertEqual(len(unit['avisos']), 1)

    def test_ean_repetido_sem_kit_primeira_linha_fica(self):
        a = self.linha_valida(1, nome='Puff A', codigo_barras='7890002')
        b = self.linha_valida(2, nome='Puff B', codigo_barras='7890002')
        resolver_eans([a, b])
        self.assertEqual(a['codigo_barras'], '7890002')
        self.assertIsNone(b['codigo_barras'])

    def test_exclusao_e_conversao_declaradas(self):
        self.assertIn(chave('Refrigerante Coca Cola 2L'), EXCLUIDOS)
        self.assertEqual(KITS_EXISTENTES[chave('Maço Palheiro Cristal')], (chave('Solto Palheiro Cristal'), 20))
        self.assertEqual(KITS[chave('Caixa de Seda Zomo Natural Perfect c/50')], (chave('Seda Zomo Natural Perfect'), 50))

    def test_validar_custo_opcional_com_flag(self):
        r = linha()
        validar(r)
        self.assertFalse(r['custo_informado'])
        self.assertEqual(str(r['preco_custo']), '0')
        r2 = linha(preco_custo='6,50')
        validar(r2)
        self.assertTrue(r2['custo_informado'])
        self.assertEqual(str(r2['preco_custo']), '6.50')


@unittest.skipUnless(os.environ.get('NOVEXA_CARGA_DSN'), 'Exige banco descartável explícito')
class PostgreSQLTest(unittest.TestCase):
    def setUp(self):
        self.conn=psycopg.connect(os.environ['NOVEXA_CARGA_DSN'],row_factory=dict_row)
        if self.conn.execute('select current_schema() as schema').fetchone()['schema']!='carga_operacional_test':
            raise RuntimeError('Teste permitido somente no schema descartável esperado')
        self.admin_id=self.conn.execute("select id from usuario where empresa_id=900001 and perfil='ADMIN'").fetchone()['id']
        self.before=snapshot(self.conn,900001)
    def tearDown(self):
        self.conn.rollback()
        self.assertEqual(snapshot(self.conn,900001),self.before)
        self.conn.close()
    def test_vinculos_estoque_zero_repeticao_sem_duplicar(self):
        rows=[linha()]
        _,indexes=planejar(self.conn,rows,900001)
        ids,created,_=gravar(self.conn,rows,900001,indexes,self.admin_id)
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
        self.assertEqual(gravar(self.conn,repeat,900001,indexes,self.admin_id)[0],[])
    def test_sem_codigo_usa_numerador_da_api_e_preserva_codigo_importado(self):
        rows=[linha(codigo_interno='',codigo_barras='7890000000028'),
              linha(2,codigo_interno='8400',codigo_barras='7890000000011')]
        _,indexes=planejar(self.conn,rows,900001)
        ids,_,kits=gravar(self.conn,rows,900001,indexes,self.admin_id)
        codigos=[self.conn.execute('select codigo_interno from produtos where id=%s',(id,)).fetchone()['codigo_interno'] for id in ids]
        self.assertEqual(codigos,['8400','8401'])
        self.assertEqual(snapshot(self.conn,900001)['movimentos'],self.before['movimentos'])
        repeat=[linha(codigo_interno='8400',codigo_barras='7890000000011'),linha(2,codigo_interno='',codigo_barras='7890000000028')]
        planejar(self.conn,repeat,900001)
        self.assertEqual([r['situacao'] for r in repeat],['DUPLICADA','DUPLICADA'])
    def test_sem_codigo_e_sem_ean_reenvio_nao_duplica_por_nome(self):
        rows=[linha(codigo_interno='')]
        _,indexes=planejar(self.conn,rows,900001)
        ids,_,kits=gravar(self.conn,rows,900001,indexes,self.admin_id)
        self.assertEqual(len(ids),1)
        again=[linha(codigo_interno='')]
        planejar(self.conn,again,900001)
        self.assertEqual(again[0]['situacao'],'DUPLICADA')
    def test_duplicidade_no_arquivo_rejeita_todas_ocorrencias(self):
        rows=[linha(),linha(2)]
        planejar(self.conn,rows,900001)
        # Código repetido: primeira ocorrência segue válida; a reenviada fica sem código
        # e, sem identificador com nome repetido, é duplicada.
        self.assertEqual([r['situacao'] for r in rows],['VALIDA','DUPLICADA'])
    def test_reusa_nomes_sem_caixa_espacos_e_rejeita_ambiguidade(self):
        self.conn.execute("insert into fornecedores(empresa_id,razao_social,ativo,data_cadastro) values (900001,' fornecedor sintético ',true,current_timestamp)")
        rows=[linha()]
        _,indexes=planejar(self.conn,rows,900001)
        ids,created,_=gravar(self.conn,rows,900001,indexes,self.admin_id)
        self.assertNotIn('fornecedor',created)
        self.conn.execute("insert into fornecedores(empresa_id,razao_social,ativo,data_cadastro) values (900001,'Fornecedor Sintético',true,current_timestamp)")
        with self.assertRaises(Bloqueio): planejar(self.conn,[linha()],900001)
    def test_outra_empresa_nao_e_vinculada(self):
        self.conn.execute("insert into empresas(id,razao_social,ativo) values (900002,'Outra sintética',true)")
        self.conn.execute("insert into marcas(empresa_id,nome,ativo) values (900002,'Marca sintética',true)")
        rows=[linha()]
        _,indexes=planejar(self.conn,rows,900001)
        ids,_,_=gravar(self.conn,rows,900001,indexes,self.admin_id)
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
        with self.assertRaises(psycopg.errors.NotNullViolation): gravar(self.conn,rows,900001,indexes,self.admin_id)
        self.conn.rollback()
        self.assertEqual(snapshot(self.conn,900001),self.before)


if __name__=='__main__': unittest.main()
