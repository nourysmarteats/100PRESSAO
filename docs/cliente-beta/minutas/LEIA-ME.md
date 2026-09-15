# Cliente Beta — pacote para revisão

Preparado em 13 de setembro de 2026. Minutas, não publicadas nem aplicadas em produção. Regulamento e aviso disponíveis em Word e Markdown.

## O que está definido

Sintonia dos Temperos Lda, NIF 519521463, indicada pelo utilizador como entidade promotora. Inscrição antes da inauguração de cada unidade; não foi estabelecido mínimo de presenças ou consumo. Benefícios após inauguração: 10% no consumo do titular e ementa exclusiva. Duração enquanto o 100PRESSÃO estiver em atividade. Acesso em toda a rede é a orientação inicial indicada pelo utilizador.

## Propostas incluídas, ainda não decisões

- Aplicar a condição mais vantajosa ao cliente, sem acumular promoções sobre o mesmo consumo.
- Ativar o benefício na inauguração da unidade de origem e aplicá-lo apenas em unidades já inauguradas.
- Identificação por conta e telefone confirmado; código temporário por pagamento. Não recolher NIF nem cópia de documento para o programa.
- Prazos de 30 dias para eliminar a conta encerrada, 90 dias para registos operacionais e três anos para prova mínima restrita. São propostas sujeitas a avaliação, não prazos impostos por lei.
- Origem declarada facultativa; separar medição da necessidade contratual. A alteração do formulário e da validação no servidor ainda não foi feita.

## Dados a completar

Morada confirmada: Praceta Eugénio de Castro, Loja 6 e 7, 2790-063 Carnaxide. Futuros operadores da rede e responsabilidades; data/hora de inauguração por unidade; cobertura de entrega, plataformas e portes; informação aplicável sobre resolução alternativa de litígios; fornecedores de autenticação/mensagens, localizações e transferências.

A verificação aritmética do NIF não substituiu consulta de titularidade em registo oficial. A morada existente no site não foi assumida como sede da sociedade.

## Transição dos inscritos atuais

1. Guardar a inscrição e a versão antiga como prova do que foi efetivamente apresentado.
2. Apresentar os termos e o aviso novos através de meio compatível com as finalidades e autorizações existentes. A mensagem de apresentação do benefício pode ter natureza promocional; validar canal e base legal antes de contactar. Não foi enviada qualquer mensagem.
3. Recolher aceitação identificada, com versão e data carimbadas no servidor. Não assinalar aceitação em nome do cliente e não fazer da autorização de marketing uma condição.
4. Preservar a elegibilidade pela data antiga. Aceitação posterior não reabre inscrições para novos titulares.
5. Antes do expurgo devido, separar apenas os dados necessários de quem tenha aderido validamente ao programa. Quem não adere permanece sujeito ao aviso anterior; não suspender o expurgo em massa.

## Implementação necessária

- Modelar unidade, campanha, fecho, origem e estatuto de rede. A configuração atual é global; o desenho final exige inspeção complementar das tabelas de unidades e autenticação, sem inventar o esquema.
- Criar adesão versionada e funções de servidor com limites, autorização e auditoria; evitar expor ou permitir apropriação de uma inscrição apenas por saber o telefone.
- Fechar inscrições no servidor no instante da inauguração; garantir a mesma informação na interface. Atualmente a função inscrever_beta_tester consulta apenas o interruptor aberto.
- Separar o programa do consentimento de marketing e do expurgo da campanha. Não alterar a versão histórica nem a numeração dos inscritos.
- Verificar elegibilidade e autorização na leitura da ementa exclusiva e no pagamento. Consumir o código de modo atómico, vinculado ao pagamento; impedir repetição mesmo após limpeza de registos auxiliares.
- Definir e implementar recuperação de conta, revogação de sessões, exceções de ligação, fornecedores de SMS e limites de custo antes de anunciar a identificação digital.
- Publicar os textos novos e a configuração de versões de forma coordenada com o comportamento real. Acrescentar qualquer nova rota às duas listas de SEO.

## Critérios de aceitação

- Antes da inauguração: aceita inscrições na campanha aberta, sem aplicar benefícios dessa campanha. No instante de fecho e depois: recusa novas inscrições mesmo por chamada direta à API.
- Unidade A encerrada para inscrições não impede a campanha pré-inauguração da unidade B. Estatuto válido em A pode ser utilizado em B apenas depois de B inaugurar, segundo a proposta a validar.
- Recusar marketing ou retirá-lo não remove o benefício. Apagar uma inscrição de campanha não elimina uma adesão válida ao programa.
- Inscrito antigo não aderente não ganha aceitação fictícia; aderente mantém a data de elegibilidade original.
- Conta partilhada recebe desconto só no consumo do titular. Não acumular benefícios por múltiplas campanhas. Cancelamento/reembolso não duplica a aplicação.
- Duas tentativas simultâneas com o mesmo código/pagamento originam uma aplicação, com resultado recuperável em caso de falha de rede.
- Cliente não elegível não lê os artigos exclusivos pela API; equipa vê apenas o mínimo necessário; pedidos públicos não escrevem diretamente em tabelas.
- Testes de concorrência e expurgo em branch temporário, nunca na produção.

## Fontes e revisão

Fontes consultadas em 13 de setembro de 2026:

- [RGPD — finalidades, fundamentos, informação, direitos e proteção de dados](https://eur-lex.europa.eu/eli/reg/2016/679/pt).
- [Regime das cláusulas contratuais gerais — comunicação, informação e cláusulas proibidas](https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1985-34436475).
- [Lei n.º 144/2015 — resolução alternativa de litígios](https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2015-119475005).

As minutas aplicam estas referências ao desenho proposto, sem constituir validação integral de conformidade. Revisão por advogado habilitado antes da publicação. Não foi usado o nome de qualquer perfil de IA como assinatura de profissional.

## Verificação dos ficheiros

Os dois Word passaram a verificação de integridade do arquivo, leitura do XML e comparação de todo o texto com as versões Markdown. Não foi possível verificar a paginação por renderização: o ambiente não dispõe de LibreOffice. Rever a apresentação no Word/Pages antes de distribuir. Não foram necessários testes da aplicação, pois só foram criados documentos; alterações paralelas na área financeira não fazem parte deste trabalho.

## Estado após revisão e autorização de publicação

Revisão interna Brandão concluída; Word regenerados com correções e morada confirmada. Não equivale a parecer assinado por advogado.

Frontend de fecho por instante/data preparado e revisto por Daniel; 16 testes beta e 74 testes totais passaram. SQL correspondente preparado em `../implementacao/fecho-beta-proposta.sql`, ainda não aplicado. Esta correção usa a configuração global atual; campanhas por unidade, adesão versionada e conservação do programa continuam por implementar e testar. Não confundir esta correção parcial com lançamento do programa.

GitHub remoto acessível por SSH; o commit atual tem estado Vercel de sucesso. O conector Vercel continua sem acesso à equipa. Nenhum push nem publicação foram efetuados.

O Supabase recusou criar o branch temporário de teste: funcionalidade disponível apenas no plano Pro ou superior. Não foi criado recurso pago. O pedido incluía uma cotação de 0,01344 por hora, mas falhou antes da criação. Não foram realizados testes de escrita ou concorrência em produção.
