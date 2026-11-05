# Proposal

## Why

A tela já suporta pagamentos multiorigem e a 23C acrescenta parciais localmente, mas nomenclatura financeira ambígua, filtros expostos simultaneamente e detalhe baseado em formulário desabilitado dificultam a leitura operacional. O Product Owner aprovou a alternativa A: evolução compacta, mantendo cinco indicadores, tabela e painel lateral.

## What Changes

### Refinamento 23D.1 aprovado pelo Product Owner

- Reorganizar somente os campos existentes do cadastro em agrupamentos claros e layout horizontal quando houver espaço, empilhado no mobile.
- Compactar o modal de pagamento, reduzindo rolagem e destacando principal/desembolso, origens financeiras e saldo restante, inclusive no parcial multiorigem.
- Tornar cronológica e legível a apresentação de baixas e estornos, com datas e vínculo entre operação e reversão explícitos.
- Refinar hierarquia visual, componentes e ações da tabela, preservando os cinco indicadores e o painel de detalhes da alternativa A.

Athom é apenas referência de organização e usabilidade, não contrato de fidelidade visual nem fonte de campos, regras ou funcionalidades. Manter React/MUI, identidade Novexa, contratos e comportamentos da 23C/23D. As alterações abaixo registram a base 23D já implementada localmente.

- Diferenciar descrição, valor original, desembolso e saldo pendente; destacar o residual de contas parciais.
- Filtros progressivos, ação textual Pagar e indicadores compactos com abrangência global e intervalos cumulativos claros.
- Estados distintos de carregamento, consulta vazia, zero confirmado e falha nos indicadores.
- Detalhe legível com histórico paginado; seleção explícita da baixa antes de qualquer estorno agrupado.
- Preservar integral como padrão, parcial explícito, identidade visual, acessibilidade, responsividade e eficiência.

## Capabilities

### New Capabilities

- `contas-pagar-operacao`: apresentação e navegação gerencial da obrigação, filtros, indicadores, pagamento e seleção da baixa no histórico. Primeira especificação formal dessa experiência; não representa um novo motor financeiro.

### Modified Capabilities

Nenhuma: ainda não existem capabilities publicadas em openspec/specs.

## Impact

Frontend existente: ContasPagar, ContaPagarDrawer, PagamentosContaPagar e PagamentoContaPagarDialog; reaproveitar React/MUI e componentes locais. Manter contratos de contaPagarService e regras em docs/architecture/financeiro.md; sem backend, migrations, dependências novas ou outras telas. A 23C/V63 e a base 23D estão implementadas localmente, sem presumir publicação. Excluídos alternativa B, novos campos, funcionalidades do Athom, novos fluxos financeiros, parcelamento, pagamento em lote e release. A base 23D teve APPLY autorizado e executado; o refinamento 23D.1 está especificado, ainda não implementado. Esta atualização não inicia APPLY; o resultado visual futuro depende da validação operacional do Product Owner.
