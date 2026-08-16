# Faturação Vendus — Estado e Conclusão

**Autor:** Daniel Cunha · **Data:** 2026-08-16 · **Estado:** ✅ CONCLUÍDO (2026-08-16)

---

## TL;DR

Tarefa encerrada. Código completo, env var definida, fatura de validação confirmada.

~~1. Definir `VENDUS_MODE=normal` nas env vars do Vercel (Production + Preview)~~ ✅ 2026-08-16
~~2. Emitir uma fatura de validação via API para confirmar o fluxo end-to-end~~ ✅ 2026-08-16

---

## O que foi investigado e concluído

### Série T01P2026

Investigada directamente no backoffice da Vendus (2026-08-16):

- **Tipo:** Série de **produção** — o prefixo "T" é apenas o nome da série, não indica modo de testes
- **Estado:** Activa, comunicada à AT
- **Documento associado:** FR (Fatura)
- **Loja:** Loja principal

### Comunicação com a AT

Tudo em ordem:

- ATCUD: **Ativo** — "Comunicação Séries de Faturação/ATCUD correctamente configurada"
- Utilizador AT: `519521463/1` ✅
- Permissões: **WSE** (Comunicação de Séries) + **WFA** (Comunicação de Faturação) ✅
- SAF-T: modo Manual (exportar mensalmente)
- Erros pendentes: nenhum

### Facturas FR T01P2026/1 e FR T01P2026/2

Pesquisadas em todas as vistas do backoffice (Faturação, Todos, Listagem de Documentos Contabilidade, Movimentos de Caixa Faturação API) — **não existem**. As chamadas de teste provavelmente falharam sem erro visível, ou ocorreram numa sessão/ambiente diferente. Não há nada para apagar.

### Causa do NIF em falta

O problema era exclusivamente do lado do código: o payload da API não enviava o campo `customer.fiscal_id`. A configuração do Vendus (série, AT, caixa API em modo Normal) estava correcta desde o início. Resolvido no código.

---

## Caixas configuradas

| Caixa | Tipo | Modo | Expira |
|---|---|---|---|
| Caixa principal | Restaurante (Gestão de Salas/Mesas) | Normal | 13/09/2026 |
| Faturação API | API (Integração Programática) | Normal | 13/10/2026 |

---

## Passos para fechar

### 1 — Env var no Vercel

```
VENDUS_MODE=normal
```

Aplicar em **Production** e **Preview**. Sem esta var, o código pode estar a correr em modo de teste ou a guardar modo indefinido.

### 2 — Fatura de validação

Após o deploy, emitir uma fatura real via API (pedido com NIF de cliente preenchido) e confirmar:

- Fatura criada na série T01P2026 com numeração sequencial correcta
- ATCUD presente no documento
- Cliente associado com NIF (não "Consumidor Final")
- Documento visível no backoffice Vendus

---

## Ficheiros relevantes

- `api/vendus-estado.js` — endpoint de estado da integração
- `docs/sql/2026-07-12-faturacao-vendus.sql` — migração de base de dados associada
- `docs/sql/2026-08-09-nif-no-checkout-online.sql` — campo NIF no checkout
