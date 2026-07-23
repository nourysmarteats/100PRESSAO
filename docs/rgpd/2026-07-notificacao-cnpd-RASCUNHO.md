# RASCUNHO — Notificação de violação de dados pessoais à CNPD (art. 33.º RGPD)

> **Estado: RASCUNHO para validação jurídica (Dr. Brandão). Não enviar sem revisão.**
> Campos entre `[[...]]` faltam confirmar — ver `2026-07-cronologia-exposicao-dados.md`, secção 7.
> A CNPD disponibiliza formulário próprio em https://www.cnpd.pt — este texto
> destina-se a preencher os campos desse formulário.

---

## 1. Responsável pelo tratamento

- **Entidade:** Sintonia dos Temperos, Lda. (estabelecimento "100PRESSÃO")
- **NIPC:** `[[NIPC da empresa]]`
- **Morada:** Praceta Eugénio de Castro, Loja 6, Carnaxide
- **Contacto:** geral@100pressao.pt · +351 935 995 011
- **Encarregado de Proteção de Dados (EPD/DPO):** `[[existe EPD designado? Se sim, nome e contacto; se não, indicar "não aplicável / não designado"]]`

## 2. Natureza da violação

- **Tipo:** violação de **confidencialidade** — acesso potencialmente não
  autorizado a dados pessoais por deficiência no controlo de acesso de leitura.
  (Não houve perda de dados nem indisponibilidade; os dados mantiveram-se
  íntegros e disponíveis para a empresa.)
- **Descrição:** a aplicação de pedidos online (`/cardapio`) guarda os dados dos
  clientes em base de dados Supabase (PostgreSQL). Por configuração incorreta das
  regras de segurança ao nível da linha (Row-Level Security), as tabelas com
  dados de clientes ficaram configuradas para permitir **leitura por qualquer
  utilizador anónimo** munido da chave pública de API do sítio — chave que, por
  desenho, é acessível a qualquer visitante do site. Em consequência, durante o
  período abaixo, esses dados estiveram tecnicamente acessíveis à leitura por
  terceiros não autorizados.

## 3. Categorias e número de titulares afetados

- **Categorias de titulares:** clientes do estabelecimento que efetuaram pedidos
  através do `/cardapio` (fase piloto).
- **Número de titulares:** **25** (registos em `sessions` desde 2026-07-07; contagem confirmada na base de dados).

## 4. Categorias e número de registos de dados pessoais

- **Categorias de dados expostos:**
  - Nome do cliente e posição de mesa (`sessions`).
  - Detalhe dos pedidos, valores, método e estado de pagamento (`orders`, `order_items`).
  - **Número de Identificação Fiscal (NIF)**, quando o cliente pediu fatura (`orders.fatura_nif`).
- **Número de registos com NIF:** **2** (contagem confirmada na base de dados).
- **Categorias especiais (art. 9.º):** nenhuma (sem dados de saúde, biometria, etc.).

## 5. Datas

- **Início da situação de exposição:** aproximadamente **2026-07-07** (entrada em
  funcionamento do piloto com dados reais de clientes).
- **Fim da exposição (correção aplicada):** **2026-07-20, 08:12:09** (confirmado
  no histórico de migrações Supabase).
- **Data de tomada de conhecimento pela empresa:** `[[data em que a equipa identificou a configuração — provavelmente 2026-07-19/20]]`.

## 6. Consequências prováveis

- Possibilidade de terceiros terem tido acesso a nome, hábitos de consumo,
  valores gastos e NIF de clientes. O NIF, combinado com o nome, é o elemento de
  maior sensibilidade (risco de utilização indevida da identidade fiscal).
- **Existência de acesso indevido efetivo:** **não verificável.** O projeto está
  no plano Free da Supabase, com retenção de logs de apenas 1 dia; à data em que
  a situação foi analisada (2026-07-20), os registos de acesso do período de
  exposição já tinham sido automaticamente eliminados. Não há, por isso, prova de
  que tenha havido acesso indevido, nem prova de que não tenha havido. A empresa
  não dispõe de meios para o confirmar retroativamente.

## 7. Medidas adotadas e propostas

**Já adotadas:**
- Remoção da política que permitia leitura anónima; a leitura passou a estar
  restrita a contas ativas da equipa (autenticadas).
- Remoção da inserção anónima direta; os pedidos passam agora por funções de
  servidor controladas, com validações defensivas.
- Publicação da versão corrigida do site em produção (2026-07-20).

**Propostas / em curso:**
- Ponderar a subscrição de um plano com maior retenção de logs (Pro: 7 dias) para
  permitir, no futuro, a deteção e análise de acessos.
- Revisão das restantes políticas de acesso da base de dados (está em análise um
  reforço às permissões de escrita das contas de equipa).

## 8. Comunicação aos titulares (art. 34.º)

- **Efetuada?** `[[Não / A decidir]]`. Ponderação em curso: a comunicação
  individual só é obrigatória havendo risco elevado; essa avaliação depende do
  resultado da análise de logs (secção 6). Texto de comunicação já preparado, em
  reserva (`2026-07-aviso-clientes-RASCUNHO.md`).

## 9. Contacto para esclarecimentos

`[[nome do ponto de contacto]]` · geral@100pressao.pt · +351 935 995 011
