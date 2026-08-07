package br.com.novexa.erp.entity;

// Importa a anotação que transforma essa classe em uma entidade JPA
// Ou seja: essa classe será ligada a uma tabela do banco de dados
import jakarta.persistence.Entity;

// Importa a configuração para gerar valores automaticamente
// Usaremos para criar o ID da empresa sem precisar informar manualmente
import jakarta.persistence.GeneratedValue;

// Define a estratégia de geração do ID
// Exemplo: o PostgreSQL cria 1, 2, 3, 4...
import jakarta.persistence.GenerationType;

// Define qual atributo será a chave primária da tabela
import jakarta.persistence.Id;

// Permite informar o nome da tabela no banco de dados
import jakarta.persistence.Table;


// Diz para o JPA que essa classe representa uma tabela
@Entity

// Define explicitamente o nome da tabela no banco
// A classe chama Empresa, mas a tabela será empresas
@Table(name = "empresas")
public class Empresa {


    // ============================
    // IDENTIFICAÇÃO DA EMPRESA
    // ============================

    // Define que esse campo é a chave primária (PRIMARY KEY)
    // Cada empresa terá um ID único
    @Id

    // Diz que o valor será criado automaticamente pelo banco
    // Exemplo:
    // Empresa 1 -> id 1
    // Empresa 2 -> id 2
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;



    // ============================
    // DADOS CADASTRAIS
    // ============================

    // Razão social é o nome oficial registrado da empresa
    // Exemplo:
    // NOVEXA SISTEMAS LTDA
    private String razaoSocial;


    // Nome fantasia é o nome comercial da empresa
    // Exemplo:
    // Novexa ERP
    private String nomeFantasia;


    // CNPJ da empresa
    // Usamos String porque possui máscara e zeros à esquerda
    // Exemplo:
    // 12.345.678/0001-90
    private String cnpj;


    // Inscrição estadual da empresa
    private String inscricaoEstadual;



    // ============================
    // CONTATOS
    // ============================

    // E-mail principal da empresa
    private String email;


    // Telefone principal
    private String telefone;



    // ============================
    // ENDEREÇO
    // ============================

    // Neste primeiro momento será um texto simples
    // Futuramente podemos criar uma entidade Endereco separada
    private String endereco;



    // ============================
    // CONTROLE DO CADASTRO
    // ============================

    // Define se a empresa está ativa no sistema
    //
    // true  = empresa funcionando
    // false = empresa desativada
    //
    // Em ERP normalmente não apagamos registros,
    // apenas desativamos
    private Boolean ativo;


}