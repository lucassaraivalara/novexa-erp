export type EnderecoCliente = {
    logradouro: string; numero: string; complemento: string; bairro: string;
    cidade: string; uf: string; cep: string; principal: boolean; entrega: boolean;
};

export type ContatoCliente = { nome: string; cargo: string; telefone: string; email: string };

export type ClienteInput = {
    nome: string; nomeFantasia: string; tipoPessoa: "FISICA" | "JURIDICA";
    cpfCnpj: string; inscricaoEstadual: string; email: string; telefone: string;
    endereco: string; ativo: boolean; enderecos: EnderecoCliente[]; contatos: ContatoCliente[];
    vendedor: string; condicaoPagamento: string; limiteCredito: number | null;
    observacoesInternas: string; instrucoesEntrega: string;
};

export type Cliente = ClienteInput & { id: number; empresaId: number; dataCadastro: string };
