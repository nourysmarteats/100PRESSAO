# 100PRESSÃO — app

Contexto permanente do repositório. Qualquer sessão de Claude que abra este projecto
lê este ficheiro primeiro e **não volta a perguntar** o que está aqui dentro.

Manter curto. Se deixar de caber num ecrã, deixa de ser lido.
Estado do trabalho em curso **não entra aqui** — vai para `docs/estado-atual.md`.

---

## Arranque de sessão — obrigatório

1. Invocar a skill `task-observer-shemot` **antes** de começar o trabalho.
   A activação por descrição não é garantida; esta linha é o gatilho.
2. Ler este ficheiro inteiro antes de propor alterações.
3. Antes de mexer na base de dados, ler `docs/referencias/esquema-bd.md`
   (esquemas `public`/`financeiro`, convenções, pg_cron).
4. Antes de estimar seja o que for sobre a base de dados, inspeccionar o esquema
   real. Nunca estimar de memória.

## Onde procurar conhecimento

- `docs/_INDICE.md` — **ler primeiro**; abrir só os documentos que a tarefa precisa.
- `docs/estado-atual.md` — o que está em curso e por fechar.
- Não listar nem ler `docs/` às cegas.

## Armadilhas conhecidas

- **Numeração dos beta testers arranca em 134, de propósito** (decisão do Leandro,
  2026-09-02). Não "corrigir". Contagem real = `count(*)`.
- `docs/consentimentos/*.txt` são imutáveis: versão nova = ficheiro novo.

## O que é

Cervejaria artesanal e petiscos no Mercado Municipal de Carnaxide (Loja n.º 6), Algés.
Sociedade do grupo Shemot. Sucessora de "O Oráculo" e, antes, "Noury Smart Eats" —
esses nomes estão arquivados e não devem reaparecer em copy nem em código.

## Stack

- React + Vite + Tailwind
- Supabase (Postgres 17) — projecto `upbwaweymbtcatfvjmdg`, região `eu-west-3`
- Vercel + GitHub
- Conta de serviço: `equipa@100pressao.pt`

**Não há ambiente de staging.** Existe um único projecto Supabase e é o de produção,
com pedidos, stock e vendas reais. Testes destrutivos ou de concorrência fazem-se num
*branch* Supabase temporário, nunca directamente.

### Áreas da aplicação

- Dashboard de Administrador
- Dashboard Operacional
- Interface de cliente por QR code
- Módulo de Colaboradores a recibos verdes (vínculos, pagamentos, candidaturas)
- Módulo Financeiro (despesas, receita externa, orçamento, fornecedores)
- Portal público de candidaturas em `/colaborador`
- Registo público de beta testers em `/beta`

### Onde estão as coisas

| | |
|---|---|
| Rotas | `src/App.jsx` — react-router-dom 7, tudo em `lazy()` + `Suspense` |
| Cliente Supabase | `src/lib/supabase.js`. Exporta **dois**: `supabase` (com sessão) e `supabasePublico` (sem persistência) |
| Estilos partilhados do admin | `src/pages/equipa/admin/comuns.jsx` — `CAMPO`, `BOTAO_PRIMARIO`, `CARTAO`, `useAviso()` |
| Dashboard de admin | `src/pages/equipa/Admin.jsx` — secções declaradas no array `SECCOES` |
| Regras de negócio | `src/lib/*.js`, funções puras, com testes em `*.test.mjs` (`npm test`) |
| Camada de dados do Financeiro | `src/lib/financeiro.js` — `fin()` = `supabase.schema('financeiro')` |
| SEO e rotas pré-renderizadas | `src/seo/pages.js` |
| Variáveis de ambiente | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (nomes; valores nunca aqui) |
| Vercel | conta por confirmar — o conector está autenticado numa equipa sem projectos |

**Regra do cliente Supabase:** páginas públicas usam `supabasePublico`. Com o
cliente normal, a sessão de staff guardada no mesmo browser interfere com
páginas que nem precisam de autenticação.

## Regras que não se negoceiam

1. **Escrita pública nunca vai directa à tabela.** Passa por função
   `SECURITY DEFINER` com validação no servidor, tecto de submissões lido das
   `definicoes` e limite por `ip_hash`. Modelos: `criar_pedido_online()`,
   `inscrever_beta_tester()`. A chave `anon` viaja no bundle do browser — assumir
   sempre que está nas mãos de qualquer pessoa.
2. **Guardar `ip_hash`, nunca o IP.**
3. **Versão de consentimento é carimbada pelo servidor**, lida das `definicoes`.
   Nunca aceite do cliente — se vier do cliente, a prova não vale nada.
4. **Todo o dado pessoal nasce com prazo de conservação.** Coluna `expira_em`
   calculada por trigger, função de expurgo, tarefa `pg_cron`, registo no
   `audit_log`. Modelo: `expurgar_candidaturas()`.
5. **O registo de um apagamento não pode recriar o dado apagado.** Guardar o
   identificador e o motivo, nunca o nome nem o contacto.
6. **Minimização à entrada.** Formulários públicos não pedem NIF, NISS, IBAN,
   morada nem data de nascimento. Esses dados entram depois, pelo painel.
7. **Nada de chaves no repositório.** A `service_role` nunca entra no código,
   nem em exemplos, nem em comentários.
8. **Nada de tabelas `backup_*` novas.** Já há cinco a apodrecer no esquema.
   Cópias fazem-se fora da base de dados.
9. **Rota nova = entrada em `src/seo/pages.js`, em `SEO_PAGES` e em
   `ORDEM_ROTAS`.** Sem ela a rota não ganha ficheiro no `dist` e o `cleanUrls`
   do Vercel devolve 404 em produção. Em desenvolvimento funciona à mesma, por
   isso não se nota até ao deploy — foi assim que o `/admin` desapareceu.
10. **Origem de campanha no URL chama-se `via`.** Um só vocabulário: o gerador
    de QR do admin emite `?via=`, o Analytics lê-o no `page_location`, e o
    registo da beta grava-o. Só minúsculas, números e hífenes.
11. **Ficheiro novo importado por outro = `git add` no mesmo commit.** O plugin
    de SEO lê `dist/index.html` no `closeBundle()`, por isso um import que não
    resolve chega ao ecrã como `ENOENT: dist/index.html` e esconde a causa real.
    Antes de commitar: `npm run build > /tmp/build.log 2>&1 && git commit …` —
    encadeado pelo código de saída, nunca por `grep` ao output.

## Quem decide o quê

| Área | Pessoa |
|---|---|
| Tecnologia, arquitectura, estimativas | Daniel Cunha (CTO) |
| RGPD, base legal, segurança, acessos | Bea Salgado |
| Prazos fiscais, societários e laborais | Sofia Bastos |
| Copy de marca e visual | Sérgio Grosman |
| Marketing, canais, medição | Marta Aguiar |
| Menu, custeio, HACCP | Rita Falcão |

Copy de marca nunca é inventada pelo agente. Placeholder até o Sérgio entregar.
