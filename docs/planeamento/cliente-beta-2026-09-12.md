# Cliente beta — preparação jurídica e técnica

Estado: decisões comerciais pendentes; não publicado. Preparação com as skills Daniel Cunha e Brandão & Associados, sem parecer de advogado externo.

Atualização de 13 de setembro: regulamento e aviso de privacidade preparados em Word e Markdown em `docs/cliente-beta/minutas/`, com guia de transição e critérios de aceitação. Textos marcados como minutas; sem alteração da aplicação ou de produção. A proposta de condição mais vantajosa sem acumulação está assinalada, não atribuída ao utilizador como decisão expressa.

## Decisões do utilizador

- Entidade indicada pelo utilizador em 13 de setembro: Sintonia dos Temperos Lda; NIF corrigido pelo utilizador para 519521463 (apresentado como 519.521.463). Dígito de controlo validado aritmeticamente; esta verificação não confirma a titularidade em registo oficial.
- O 100PRESSÃO mantém a identidade de cervejaria luso-brasileira; as cartas variam por horário.
- Inscrições beta até à inauguração de cada unidade 100PRESSÃO; cada unidade fecha o seu grupo a novas inscrições nesse momento.
- Benefícios mantidos enquanto o 100PRESSÃO estiver em atividade, conforme confirmação do utilizador.
- Orientação inicial confirmada em 13 de setembro: o cliente beta poderá usufruir dos benefícios em qualquer unidade 100PRESSÃO, incluindo futuras unidades. O utilizador qualificou esta decisão como "a princípio"; confirmar a redação definitiva antes da publicação.
- A resposta sobre elegibilidade especificou inscrição antes da inauguração de cada unidade. Não acrescentar obrigação de presença ou consumo mínimo, que não foram definidos pelo utilizador.
- Durante a beta: sem desconto de 10% nem ementa secreta.
- Depois da inauguração: clientes beta elegíveis têm ementa exclusiva e 10% de desconto no próprio consumo.
- Segundo o utilizador, os atuais inscritos ainda não receberam esta proposta.
- Proposta técnica, ainda não decisão expressa do utilizador: não recolher NIF apenas para identificar o titular do benefício.

## Verificações de 12 de setembro

Leitura do código e consultas de metadados/funções em produção, sem escrita nem consulta de dados pessoais:

- `src/pages/Beta.jsx` apresenta a fase beta e lotes, sem os benefícios novos.
- `src/components/AvisoPrivacidadeBeta.jsx` apresenta conservação até 30 dias depois do fim; a identidade do responsável ainda precisa de confirmação conforme AGENTS.md.
- `public.beta_testers` não tem campos de adesão ao regulamento de cliente beta.
- `inscrever_beta_tester()` verifica `definicoes.beta.aberto`, mas não verifica a data de inauguração. Não assumir que configurar a data encerra automaticamente as inscrições.
- `expurgar_beta_testers()` usa o fim da beta e o consentimento de contacto posterior para determinar apagamentos. O estatuto novo não pode depender desse consentimento nem desaparecer por cascata quando a inscrição antiga for expurgada.
- O esquema e as funções reais têm evoluções posteriores à descrição do AGENTS.md. Preservar a numeração atual; não alterar nesta intervenção.

## Decisões necessárias para publicar

1. Consolidar no regulamento a orientação de benefícios em toda a rede, incluindo unidades futuras. Identificar quem assume a obrigação perante o cliente e como se aplica a unidades exploradas por entidades diferentes, se existirem. Não presumir perda do estatuto pelo encerramento da unidade de origem.
2. Formalizar a elegibilidade pela inscrição antes da inauguração da respetiva unidade, sem acrescentar requisitos retroativos; distinguir elegibilidade de aceitação do regulamento novo.
3. Denominação e NIF fornecidos: Sintonia dos Temperos Lda, 519521463. Morada confirmada: Praceta Eugénio de Castro, Loja 6 e 7, 2790-063 Carnaxide. Confirmar a capacidade da promotora para assumir o programa em toda a rede.
4. Âmbito dos 10%: consumo do titular, identificação dos seus artigos numa conta partilhada, acumulação com outras promoções e eventuais exclusões.
5. Momento exato de inauguração e fecho, na hora de Lisboa. A data pode ser configurada mais tarde, mas antes da entrada em vigor.

## Alterações preparadas em âmbito

- Regulamento e aviso novos, versionados; preservar os avisos históricos e a prova dos atuais inscritos.
- Adesão própria ao programa, separada de marketing, com versão e instante carimbados pelo servidor. Não considerar os atuais inscritos aderentes a termos que não conheceram.
- Registo de elegibilidade/benefício independente da retenção da campanha, com minimização, prazo de conservação e expurgo definidos para a finalidade nova.
- Fecho de novas inscrições no servidor e na interface no momento configurado; ativação dos benefícios apenas depois da inauguração.
- Separar a campanha de cada unidade do estatuto do cliente na rede: guardar a unidade/campanha de origem e o seu momento de fecho, sem limitar a utilização do benefício a essa unidade. A interpretação a concretizar é ativação na inauguração da unidade de origem e utilização nas unidades já inauguradas; não antecipar benefícios durante a fase beta de uma unidade. Manter um único estatuto por cliente e impedir acumulação de descontos por múltiplas inscrições.
- Conta do cliente com confirmação de telefone e recuperação prevista. Código temporário associado ao pagamento, validação e consumo atómico no servidor. Não prometer prova de identidade física.
- Ementa exclusiva protegida também na camada de dados; ocultar apenas no ecrã não basta.
- Validar desconto uma vez por pagamento, segundo o consumo elegível; registar exceções operacionais sem duplicação de benefício.
- Rever custos de SMS, fornecedor e funcionamento com falha de internet antes de implementar autenticação.
- Testes de concorrência ou destrutivos apenas num branch temporário Supabase. Nenhuma migração executada em produção nesta preparação.
- Texto de campanha final a cargo do Sérgio, alinhado com Marta; não publicar placeholders nem promessas incompletas.

## Fontes jurídicas consultadas

- RGPD, artigos 5.º, 6.º, 7.º e 13.º: https://eur-lex.europa.eu/eli/reg/2016/679/pt
- Cláusulas contratuais gerais, deveres de comunicação e informação e limites a alterações: https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1985-34436475

A validação jurídica final exige fechar os factos acima e revisão por advogado habilitado antes de publicar o regulamento.

## Revisão e testes — 13 de setembro

Revisão jurídica interna registada em `docs/cliente-beta/minutas/revisao-brandao-2026-09-13.md`; morada posteriormente confirmada e integrada nas minutas. Frontend de fecho preparado, 16 testes beta passaram, SQL de servidor apenas proposto. Publicação não efetuada. Branch de teste recusado pelo Supabase por limitação do plano; a integração de adesões e conservação não foi aplicada nem testada em produção.
