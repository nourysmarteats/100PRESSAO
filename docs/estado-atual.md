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

