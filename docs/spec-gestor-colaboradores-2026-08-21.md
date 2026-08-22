# Especificação Técnica: Gestor de Colaboradores

**Projecto:** 100PRESSÃO — Mercado Municipal de Carnaxide (Loja n.º 6), Algés
**Autor:** Daniel Cunha, Direcção de TI
**Data:** 21 de Agosto de 2026
**Versão:** 1.0 — para validação
**Estado:** proposta. Nada nesta especificação está implementado, com excepção do que consta na secção 11.

---

## 1. Contexto e Objectivo

100PRESSÃO vai trabalhar com pessoas em regimes diferentes — contrato de trabalho, prestação de serviços, estafetas — e hoje não existe sítio nenhum onde isso viva. Existe um ecrã de administração que calcula dependência económica de prestadores a recibos verdes, e mais nada.

Este documento especifica duas peças que se completam:

1. **Gestor de Colaboradores** — módulo no painel de administração com a informação completa de cada pessoa: estado, vínculo, documentos, histórico de pagamentos e apuramento de dependência económica.
2. **Portal de candidatura** — página pública em `100pressao.pt/colaborador` onde uma pessoa se propõe, preenche os seus dados e anexa comprovativos.

O objectivo não é gerir pessoas melhor do que uma folha de cálculo. É ter **um único sítio onde a informação está certa**, com registo de quem a introduziu e quando, para o dia em que a ACT, a Segurança Social ou o contabilista perguntarem.

---

## 2. Âmbito

### Incluído

- Ficha completa de colaborador, com estados e histórico
- Vínculo contratual registado, com fundamento legal escrito
- Arquivo de documentos por colaborador, em armazenamento privado
- Registo e apuramento de pagamentos (já parcialmente construído)
- Formulário público de candidatura, com anexos
- Triagem de candidaturas no painel: aceitar, recusar, arquivar
- Aviso de privacidade e eliminação automática de candidaturas antigas

### Excluído desta fase

- Processamento de salários e envio de DMR à Segurança Social — é do contabilista
- Assinatura digital de contratos
- Registo de horas, escalas e assiduidade — pertence ao módulo de operação
- Avaliação de desempenho

---

## 3. Princípio de arquitectura

**Um candidato nunca escreve na tabela `colaboradores`.**

```
  Público                    Administração                  Registo definitivo
  ───────                    ─────────────                  ──────────────────
  /colaborador     ──►   colaborador_candidaturas   ──►   colaboradores
  (anónimo,              (triagem, decisão do             (dados verificados,
   insert only)           admin, sem edição do             ligados a pagamentos
                          candidato)                       e apuramentos)
```

A razão é simples: os dados que alimentam o apuramento da dependência económica e o cumprimento laboral têm de ser dados que alguém de 100PRESSÃO verificou. Se um formulário anónimo puder escrever directamente na ficha de um colaborador activo, perde-se a única coisa que dá valor a este sistema — a confiança no número.

A promoção de candidatura a colaborador é um acto explícito de um administrador, e fica registada no `audit_log`.

---

## 4. Modelo de dados

### 4.1 Tabelas novas

**`colaborador_candidaturas`**

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text NOT NULL | |
| `email` | text NOT NULL | validado |
| `telefone` | text | |
| `funcao_pretendida` | text NOT NULL | lista fechada: cozinha, balcão, sala, entregas, outra |
| `disponibilidade` | text | texto livre, curto |
| `experiencia` | text | texto livre |
| `mensagem` | text | |
| `estado` | text | `nova` · `em_analise` · `entrevista` · `aceite` · `recusada` · `arquivada` |
| `notas_internas` | text | nunca visível ao candidato |
| `colaborador_id` | uuid FK | preenchido quando promovida |
| `consentimento_reserva` | boolean | guardar para futuras oportunidades |
| `origem` | text | `portal` · `presencial` · `indicacao` |
| `ip_hash` | text | hash, não o IP — só para limitação de abuso |
| `criado_em` | timestamptz | |
| `expira_em` | date | calculado; usado pela rotina de eliminação |

**`colaborador_documentos`**

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `colaborador_id` | uuid FK | nullable |
| `candidatura_id` | uuid FK | nullable — um dos dois, nunca ambos vazios |
| `tipo` | text | ver 6.3 |
| `caminho` | text | caminho no bucket privado |
| `nome_original` | text | |
| `bytes` | int | |
| `mime` | text | |
| `validade` | date | para documentos que caducam |
| `carregado_em` | timestamptz | |
| `carregado_por` | uuid | null quando veio do portal público |

### 4.2 Colunas a acrescentar em `colaboradores`

| Coluna | Tipo | Notas |
|---|---|---|
| `estado` | text | `candidato` · `activo` · `suspenso` · `inactivo` |
| `vinculo` | text | `contrato_trabalho` · `termo_certo` · `muito_curta_duracao` · `intermitente` · `tempo_parcial` · `prestacao_servicos` |
| `vinculo_fundamento` | text | obrigatório quando o vínculo é a termo ou prestação de serviços |
| `funcao` | text | |
| `data_inicio` / `data_fim` | date | |
| `candidatura_id` | uuid FK | de onde veio |

O campo `vinculo_fundamento` é deliberadamente obrigatório. Um contrato a termo sem fundamento escrito converte-se em contrato sem termo, e uma prestação de serviços sem justificação é o primeiro ponto que a ACT questiona.

---

## 5. Requisitos funcionais

### 5.1 Gestor de Colaboradores (`/admin` → Colaboradores)

1. Listar colaboradores com filtro por **estado** (activo, suspenso, inactivo, candidato) e por **vínculo**.
2. Contadores no topo: activos, em candidatura, contribuição estimada do ano, documentos por regularizar.
3. Ficha individual com: dados pessoais, vínculo e fundamento, documentos, pagamentos do ano, apuramento de dependência económica (já implementado), reconciliação com estafetas.
4. Histórico de pagamentos por ano, com totais por entidade e por unidade de apuramento.
5. Alerta de documentos caducados ou a caducar em menos de 30 dias.
6. Alterar estado de um colaborador, com data e motivo. Nunca apagar — inactivar.
7. Exportação CSV do ano para entregar ao contabilista.

### 5.2 Triagem de candidaturas (`/admin` → Colaboradores → Candidaturas)

8. Lista de candidaturas por estado, mais recentes primeiro.
9. Ver a candidatura completa e os anexos, através de URL assinado temporário.
10. Mudar estado; registar notas internas.
11. **Promover a colaborador** — cria o registo em `colaboradores`, liga os documentos, regista no `audit_log`.
12. **Eliminar definitivamente** — apaga registo e ficheiros. Acção irreversível, com confirmação.

### 5.3 Portal público (`100pressao.pt/colaborador`)

13. Formulário numa página, sem registo de conta e sem palavra-passe.
14. Campos da fase 1 (ver 6.2) e, no máximo, **três** anexos.
15. Aviso de privacidade visível antes da submissão, com uma caixa de confirmação de leitura que não vem pré-marcada.
16. Caixa separada, opcional, para consentir a conservação por 12 meses para futuras oportunidades.
17. Confirmação no ecrã e email automático ao candidato a confirmar a recepção.
18. Protecção contra submissões automáticas (ver 7.2).
19. A página `/faca-parte`, hoje um `mailto:`, passa a apontar para aqui. Não devem existir duas portas de entrada.

---

## 6. Dados pessoais e RGPD

Esta é a secção que decide se o projecto avança como está ou é redesenhado. Um formulário público que recolhe documentos de identificação é a recolha de dados mais sensível que 100PRESSÃO alguma vez fez — maior do que qualquer coisa do lado do cliente.

### 6.1 Fundamento de licitude

**Artigo 6.º, n.º 1, alínea b) do RGPD** — diligências pré-contratuais a pedido do titular. Não é consentimento, e é importante que não seja: consentimento numa relação candidato/empregador raramente é livre, e seria revogável a meio do processo.

O consentimento aplica-se **apenas** à conservação para futuras oportunidades, que é uma finalidade distinta e por isso tem caixa própria.

### 6.2 Minimização: duas fases, não uma

O erro caro seria pedir tudo no formulário. A regra é pedir em cada momento só o que é necessário nesse momento.

**Fase 1 — candidatura (portal público)**

Nome, email, telefone, função pretendida, disponibilidade, experiência, mensagem. Anexos: currículo, certificado de formação (por exemplo higiene e segurança alimentar), carta de condução para entregas.

**Fase 2 — contratação (introduzido no painel, após decisão)**

NIF, NISS, IBAN, morada, data de nascimento, contacto de emergência, documentos contratuais.

Nenhum dado da fase 2 é pedido a quem ainda não foi seleccionado. Se a candidatura for recusada, 100PRESSÃO nunca chega a possuir o NIF nem o IBAN dessa pessoa — que é exactamente o que se quer.

### 6.3 O Cartão de Cidadão: não pedir, em fase nenhuma do portal

O artigo 5.º, n.º 2 da Lei n.º 7/2007 só permite reproduzir o Cartão de Cidadão quando a lei o preveja expressamente, por ordem judicial, ou com consentimento do titular. A CNPD acrescenta a condição que torna isto quase inaplicável a um formulário web: **o consentimento só é livre se a pessoa tiver uma alternativa efectiva** para provar a identidade. Num formulário onde o upload é obrigatório para submeter, não há alternativa nenhuma, logo não há consentimento válido.

O sancionamento das infracções à Lei 7/2007 cabe ao IRN; a CNPD trata do tratamento de dados que resulta da cópia.

**Decisão técnica:** o portal não aceita cópias de documentos de identificação. O tipo de anexo é uma lista fechada e o cartão de cidadão não consta dela. A identidade verifica-se presencialmente, na entrevista, com o cartão à frente e os dados transcritos à mão para o painel — que é uma das alternativas que a própria CNPD indica.

Documentos aceites no portal: **currículo**, **certificados de formação**, **carta de condução** (só para função de entregas). Nada mais.

### 6.4 Conservação

| Situação | Prazo | Mecanismo |
|---|---|---|
| Candidatura recusada, sem consentimento de reserva | 6 meses | `expira_em` + rotina automática |
| Candidatura recusada, com consentimento de reserva | 12 meses | idem, renovável se o candidato reconfirmar |
| Candidatura promovida a colaborador | segue o prazo do colaborador | |
| Colaborador — dados contratuais e de pagamento | 5 anos após cessação | prazo fiscal e laboral; confirmar com o Ricardo |

A rotina de eliminação corre diariamente, apaga registo **e ficheiros no bucket**, e escreve no `audit_log` quantos eliminou. Um prazo de conservação que ninguém executa não é um prazo — é uma frase numa política.

### 6.5 Informação e direitos

- Aviso de privacidade específico do recrutamento, apresentado no formulário, não escondido atrás de uma hiperligação.
- A política em `/privacidade` tem de passar a cobrir candidaturas. Hoje não as menciona de todo — é uma lacuna que existe antes deste projecto e que este projecto obriga a fechar.
- Canal para exercício de direitos (acesso, rectificação, apagamento, oposição) com resposta em 30 dias.
- Registo destas operações no registo de actividades de tratamento.

### 6.6 O que não se pergunta, nunca

Estado civil, filhos, nacionalidade, saúde, gravidez, sindicato, religião, orientação sexual, cadastro. Não por delicadeza — porque são categorias especiais ou dados excessivos, e recolhê-los num formulário de candidatura é ilícito e é prova documental de discriminação potencial se alguém contestar uma recusa.

---

## 7. Requisitos de segurança

### 7.1 Acessos e RLS

| Tabela | Anónimo | Equipa | Admin |
|---|---|---|---|
| `colaborador_candidaturas` | `INSERT` apenas | — | tudo |
| `colaborador_documentos` | `INSERT` apenas | — | tudo |
| `colaboradores` | — | — | tudo |
| `colaborador_pagamentos` | — | — | tudo |

O anónimo pode inserir e **não pode ler nada**. Um erro de RLS aqui expõe candidaturas de pessoas reais a qualquer visitante do site, e é o género de falha que só se descobre depois de acontecer.

### 7.2 Portal público

- Bucket `candidaturas` **privado**, com limite de 5 MB por ficheiro e MIME restrito a PDF, JPEG e PNG.
- Validação do tipo de ficheiro **no servidor**, via Edge Function — o `accept` do input e o `Content-Type` do pedido são ambos falsificáveis.
- Máximo de 3 ficheiros por candidatura.
- Limitação por hash do IP: 3 submissões por hora, 10 por dia.
- Turnstile ou equivalente sem cookies de rastreio, para não abrir uma frente nova de RGPD.
- Leitura dos anexos no painel exclusivamente por URL assinado com validade de 5 minutos.

### 7.3 Registo

Escrever no `audit_log`: promoção a colaborador, alteração de vínculo, eliminação de candidatura, descarregamento de documento, execução da rotina de expurgo.

---

## 8. Uma questão que a tecnologia não resolve

O portal recolhe candidaturas para **cozinha, balcão, sala e entregas**. São funções contínuas, prestadas no espaço de 100PRESSÃO, com equipamento de 100PRESSÃO e horário definido por 100PRESSÃO. O artigo 12.º do Código do Trabalho faz presumir contrato de trabalho quando se verificam duas destas características, e aqui verificam-se quatro.

Por isso o campo `vinculo` é preenchido pelo administrador **depois** da decisão, e nunca é oferecido ao candidato como escolha. Um formulário que pergunte "prefere recibos verdes ou contrato?" é, em si mesmo, um documento desfavorável.

A lista de valores admissíveis em `vinculo` inclui os instrumentos legais de flexibilidade — termo certo por início de laboração, muito curta duração, intermitente, tempo parcial — precisamente para que o sistema torne fácil fazer a coisa certa. Quais se aplicam a cada função é matéria para o Dr. Brandão, não para esta especificação.

---

## 9. Critérios de aceitação

1. Um visitante anónimo consegue submeter uma candidatura completa em menos de 4 minutos, em telemóvel.
2. Um visitante anónimo, com a chave pública do Supabase em mão, **não consegue ler** uma única linha de `colaborador_candidaturas` — verificado por teste explícito.
3. Um ficheiro `.exe` renomeado para `.pdf` é recusado pelo servidor.
4. Um documento anexado só abre no painel através de URL assinado, e a ligação deixa de funcionar passados 5 minutos.
5. Uma candidatura com `expira_em` no passado desaparece — registo e ficheiros — na execução seguinte da rotina, com linha no `audit_log`.
6. Promover uma candidatura cria o colaborador, transfere os documentos e regista no `audit_log`, numa só transacção.
7. Guardar um colaborador com vínculo a termo e sem fundamento escrito é recusado pela base de dados, não apenas pelo formulário.
8. O painel lista, filtra por estado e exporta o CSV do ano sem erros com 50 colaboradores e 600 pagamentos.
9. Nenhum campo do formulário pede documento de identificação.
10. A página `/privacidade` descreve o tratamento de candidaturas, com finalidade, fundamento e prazo.

---

## 10. Faseamento

| Fase | Conteúdo | Depende de |
|---|---|---|
| **A** | Colunas novas em `colaboradores`; gestor interno com estados, vínculo, filtros e ficha completa | nada |
| **B** | `colaborador_documentos` + bucket privado + upload no painel | A |
| **C** | Aviso de privacidade de recrutamento e actualização de `/privacidade` | — |
| **D** | Portal `/colaborador` + `colaborador_candidaturas` + RLS + Edge Function de validação | B, C |
| **E** | Triagem e promoção no painel | D |
| **F** | Rotina de expurgo + email de confirmação | D |

**A fase C não é opcional nem adiável para depois do lançamento.** Publicar um formulário de recolha de dados pessoais sem aviso de privacidade é incumprimento do artigo 13.º do RGPD no primeiro minuto de vida da página.

---

## 11. Estado actual

Já existe e está aplicado em produção (migração `colaboradores_recibos_verdes`, 21/08/2026):

- `entidades_grupo`, `colaboradores`, `colaborador_rendimento_anual`, `colaborador_pagamentos`
- Políticas RLS de administrador nas quatro tabelas
- `src/lib/colaboradores.js` — apuramento de dependência económica, consolidado por agrupamento empresarial, com 31 testes
- Ecrã `/admin` → Colaboradores, com entidades, colaboradores, pagamentos e apuramento

Falta tudo o que está descrito nas secções 4 a 7.

---

## 12. Decisões que dependem de ti

1. **Prazos de conservação** — proponho 6 e 12 meses. Confirmar com o Dr. Brandão.
2. **Funções a abrir no portal** — cozinha, balcão, sala, entregas. Faltam? Sobram?
3. **Email de recepção das candidaturas** — `geral@` ou `equipa@`?
4. **Quem faz a triagem** — só administradores, ou criar um papel intermédio?
5. **Vínculo por defeito** por função — decisão do Brandão, e o sistema segue.
6. **Turnstile** — Cloudflare é gratuito neste volume; confirmar que aceitas mais um fornecedor no stack.

---

**Contacto:** Leandro Noury Miranda — equipa@100pressao.pt

## Fontes

- [CNPD — Reprodução do Cartão de Cidadão](https://www.cnpd.pt/cidadaos/areas-tematicas/reproducao-cartao-cidadao/)
- [Lei n.º 7/2007, de 5 de Fevereiro — Cartão de Cidadão](https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=2807&tabela=leis)
- [Guia Prático Entidades Contratantes — Instituto da Segurança Social](https://www.audico.pt/wp-content/uploads/2022/10/Entidades_Contratantes.pdf)
- [Guia Fiscal 2026 – Segurança Social — PwC](https://www.pwc.pt/pt/pwcinforfisco/guia-fiscal/2026/seguranca-social.html)
