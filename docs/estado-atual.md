# Estado actual — em curso e por fechar

Movido do CLAUDE.md em 2026-09-27. Actualizar aqui, não no CLAUDE.md.

## Beta testers

**Beta testers — no ar e a receber inscrições.** Rota `/beta`, gestão em
Admin → Beta testers. Campanha de abertura em três actos: pré-abertura → abertura
em beta → inauguração, que fecha a beta. Vagas em três lotes (`vaga` 1/2/3),
atribuídas à mão no admin.

`src/pages/Beta.jsx`, `src/lib/beta.js` (+ testes),
`src/pages/equipa/admin/BetaTesters.jsx`, `src/components/AvisoPrivacidadeBeta.jsx`.
Texto do aviso arquivado em `docs/consentimentos/beta-2026-08-28.v1.txt` — é para
lá que aponta o `aviso_versao` gravado em cada linha. **Ficheiro imutável:** versão
nova é ficheiro novo, nunca uma edição.

**A numeração arranca em 134, e é de propósito.** Não é bug nem resto de
testes: decisão do Leandro em 2026-09-02, para que quem se inscreve não receba
um cartão com 001 e leia nisso falta de procura. A tabela foi limpa dos dados
de ensaio (rasto em `audit_log`, acção `beta_testers_teste_removidos`) e a
coluna *identity* reiniciada. **Não "corrigir" isto.** A contagem real de
inscritos é sempre `count(*)`, nunca o número mais alto — no admin já é assim.

Fica em aberto uma coisa de copy, para o Sérgio: o cartão diz "És o beta tester
n.º 134", o que promete uma posição numa fila que não existe. Um número que se
lê como matrícula ("Beta tester · 134") dá o mesmo efeito sem afirmar nada.

Por fechar, tudo fora do código:

- `definicoes.beta.beta_terminou_em` — pôr a data da inauguração. É isso que fecha
  a beta, arranca o prazo de 30 dias e manda expurgar quem não consentiu contacto
  posterior.
- NIF da entidade responsável nos avisos, e a mesma identidade nas três páginas
  (`/beta`, `/colaborador`, política de privacidade) — hoje divergem.
- Secção 11 da política de privacidade, e fechar a secção 5.
- Entidade responsável pelo tratamento: a concessão do mercado ainda está em nome
  pessoal; a transferência para a sociedade está pendente.

**Dois consentimentos, não um.** O primeiro acto não é consentimento nenhum — é o
aviso do artigo 13.º, e a base legal da inscrição é a alínea b). O segundo
(`contacto_pos_beta`, opcional, nunca pré-marcado) é o que permite falar com a
pessoa depois da inauguração. Recolhidos no mesmo acto, com carimbos separados.
O segundo nunca pode passar a obrigatório: um consentimento que é condição de
acesso não é livre e deixa de valer. Só a própria pessoa o dá ou retira — no
painel é campo de leitura.


## Delivery do restaurante online — empresas operadoras de frota

Ata de 2026-10-12 (vault 100PRESSÃO, `Operações/Ata-Reuniao-Delivery-2026-10-12.md`).
O 100PRESSÃO **nunca paga directamente a estafetas**: as entregas são feitas por
empresas que se registam em `/parceiro-entregas` e são aprovadas no admin.

**Fase 1 — feita.** Migração `20261012120000_empresas_entrega.sql` aplicada em
produção a 2026-10-12 (pelo Leandro, no SQL Editor). Tabela `empresas_entrega`,
função pública `registar_empresa_entrega()`, empresa de simulação (NIPC fictício
599999993, `simulacao=true`), leitura de `estafetas` restrita a admin.
Página `src/pages/ParceiroEntregas.jsx`, admin `admin/EmpresasEntrega.jsx`,
regras em `src/lib/empresasEntrega.js`. Textos legais em `docs/consentimentos/*-empresas-entrega-2026-10-12.v1.txt`
(lidos pela página via `?raw` — a versão mostrada é a gravada).

**Regras fixas (art. 12.º-A CT):** aceitar/recusar sem penalização; preço só com a
empresa; GPS só para chamar, sem histórico; sem exclusividade nem horários.

**Fase 2 — por fazer:** portal da empresa (acesso próprio, NUNCA via `perfis` —
`e_equipa()` abriria pedidos e clientes), app do estafeta (PWA, convite da empresa),
despacho misto (todos → proximidade), link de acompanhamento do cliente,
relatório mensal para conferir a fatura, substituição do fluxo WhatsApp em `Staff.jsx`.
Sem acordo art. 28.º assinado, nenhum dado de cliente segue para a empresa.

**Fase 2A — código pronto (12/10/2026), migração `20261013090000_despacho_entregas_2a.sql` por aplicar.**
Opção B: registo de contas e contas anónimas DESLIGADOS no Supabase; contas de empresa/estafeta só
nascem em `api/entregas-acesso.js` (service_role). Sessões isoladas: `supabaseEmpresa` (sb-empresa) e
`supabaseEstafeta` (sb-estafeta) em `src/lib/supabase.js`; o cliente da equipa não lê o link de entrada
em /empresa e /estafeta. Páginas: `src/pages/Empresa.jsx`, `src/pages/Estafeta.jsx`; Staff com
"Chamar estafeta" (fluxo WhatsApp/escolha manual removido); admin com convite para o portal, convite
de estafeta e interruptor `definicoes.entrega.despacho_teste` (ligado = só empresas de simulação).
A migração também fecha a leitura de `products`/`stock_*` a sessões que não sejam da equipa.
Por fazer: notificações push (Web Push + chaves VAPID na Vercel) — por agora, tempo real + som com a app aberta.

**Fase 2B — código pronto (13/10/2026), migração `20261013120000_despacho_entregas_2b.sql` por aplicar.**
Proximidade: `definicoes.entrega.despacho_modo` ('todos'|'proximidade', interruptor no admin); oferta ao
mais próximo da loja com posição < 5 min; `escalar_ofertas_proximidade()` (pg_cron, 20 s) passa ao seguinte
ao fim de 60 s e, esgotados, oferece a todos. Posição: só a actual (`estafetas.posicao_*`), enviada pela app
só com a app aberta e só em modo proximidade ou a meio de uma entrega; apagada ao ficar indisponível, ao
entregar (se indisponível) e quando tem > 15 min (cron 5 min). Cliente: `/acompanhar?p=<id>` via
`acompanhar_entrega()` (posição só em 'recolhido'; link morto 2 h após entregue), link na confirmação e no
email. Relatório mensal + "Lançar fatura" (Financeiro, Serviços externos) em `admin/RelatorioEntregas.jsx`.
