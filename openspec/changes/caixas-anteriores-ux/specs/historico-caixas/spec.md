# Spec Delta

## Purpose

Permite consultar sessões de caixa encerradas e revisar seus dados operacionais de forma clara, mantendo os registros e cálculos existentes.

## ADDED Requirements

### Requirement: Grid de sessões encerradas
The system SHALL apresentar as sessões encerradas em um grid responsivo e legível, preservando os campos, paginação e ações já suportados pela consulta atual, sem introduzir filtros novos.

#### Scenario: Consulta do histórico
- **WHEN** a pessoa usuária abre a aba Caixas Anteriores
- **THEN** o grid apresenta os dados existentes com hierarquia, alinhamento e ações consistentes com os grids financeiros aprovados, sem alterar os controles de consulta nem os contratos disponíveis

#### Scenario: Lista extensa em viewport estreita
- **WHEN** a pessoa usuária consulta sessões em viewport estreita ou com muitos registros
- **THEN** os dados e a paginação permanecem acessíveis sem sobrepor ações ou perder a capacidade de abrir os detalhes

### Requirement: Detalhes organizados em modal
The system SHALL apresentar os detalhes da sessão selecionada em um modal centralizado e responsivo, distribuindo os dados atuais nas abas Resumo, Conferência e Movimentações.

#### Scenario: Revisão do resumo
- **WHEN** a pessoa usuária abre uma sessão encerrada
- **THEN** a aba Resumo apresenta os dados gerais da sessão e sua composição de abertura já disponíveis

#### Scenario: Revisão da conferência
- **WHEN** a pessoa usuária seleciona a aba Conferência
- **THEN** são apresentados os valores esperados, informados e diferenças, incluindo os avisos já existentes para conferências legadas

#### Scenario: Revisão das movimentações
- **WHEN** a pessoa usuária seleciona a aba Movimentações
- **THEN** são apresentadas as movimentações existentes com seus tipos, horários, valores e informações de origem já disponíveis

#### Scenario: Fechamento do modal
- **WHEN** a pessoa usuária fecha o modal ou seleciona outra sessão
- **THEN** a navegação permanece na aba Caixas Anteriores e os dados do histórico não são alterados

### Requirement: Preservação da operação atual
The system SHALL manter inalterados a aba Caixa Atual, os fluxos de abertura e fechamento, os cálculos operacionais, os filtros e contratos existentes do histórico.

#### Scenario: Uso de Caixa Atual
- **WHEN** a pessoa usuária alterna para Caixa Atual
- **THEN** os comportamentos de abertura, acompanhamento, movimentação e fechamento permanecem iguais aos atuais

#### Scenario: Consulta sem mudança de contrato
- **WHEN** a interface carrega a lista ou os detalhes de uma sessão encerrada
- **THEN** utiliza os contratos existentes e apresenta os valores sem recalcular ou modificar regras de negócio
