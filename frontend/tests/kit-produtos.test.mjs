import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
const server=await createServer({server:{middlewareMode:true},appType:"custom"});
const {prepararComposicao}=await server.ssrLoadModule("/src/pages/Produtos/composicaoProduto.ts");
const {novoRascunho,criarPedido}=await server.ssrLoadModule("/src/pages/Vendas/pdv.ts");
await server.close();
const linha=()=>({produtoId:3,nome:"Componente",unidade:"CX",unidadeEstoque:"UN",quantidade:"1,5",fator:"6"});
test("composição envia conversão explícita e números decimais",()=>{
    assert.deepEqual(prepararComposicao([linha()]),[{produtoId:3,unidade:"CX",quantidade:1.5,fator:6}]);
});
for(const valor of ["", "-1", "0", "abc", "1.0001"])
    test(`quantidade inválida ${JSON.stringify(valor)} não pode ser salva`,()=>assert.throws(()=>prepararComposicao([{...linha(),quantidade:valor}])));
test("composição vazia ou repetida não chega à gravação",()=>{
    assert.throws(()=>prepararComposicao([]));assert.throws(()=>prepararComposicao([linha(),linha()]));
});
test("pedido vende somente o kit e preserva sua versão conferida",()=>{
    const r={...novoRascunho(1),itens:[{produto:{id:1,nome:"Kit",composto:true,composicaoVersao:2,precoVenda:10},quantidade:"2"}],recebido:"20",configuracaoFormaPagamentoId:1};
    const p=criarPedido(r,"uuid");
    assert.equal(p.itens.length,1);assert.equal(p.itens[0].quantidade,2);assert.equal(p.itens[0].composicaoVersaoEsperada,2);
    assert.equal("componentes" in p.itens[0],false);
});
