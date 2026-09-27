# Índice de docs/ — ler isto antes de abrir qualquer outro ficheiro

Uma linha por documento. Abrir só o que a tarefa precisa. Ao criar ou arquivar
um documento em `docs/`, actualizar esta lista no mesmo commit.

## Estado e referência
| Ficheiro | O quê |
|---|---|
| `estado-atual.md` | O que está em curso e por fechar (sai do CLAUDE.md) |
| `referencias/esquema-bd.md` | Esquemas `public`/`financeiro`, convenções, pg_cron — ler antes de mexer na BD |
| `sql/` (37 ficheiros, 2026-07-11 → 2026-08-27) | Migrações aplicadas à mão, por data. Não é a fonte de verdade do esquema — inspeccionar a BD |

## Cliente Beta / beta testers
| Ficheiro | O quê |
|---|---|
| `planeamento/cliente-beta-2026-09-12.md` | Preparação jurídica e técnica do programa |
| `cliente-beta/minutas/LEIA-ME.md` | Pacote para revisão — ponto de entrada das minutas |
| `cliente-beta/minutas/aviso-privacidade-cliente-beta-2026-09-13.md` (+ .docx) | Minuta do aviso de privacidade |
| `cliente-beta/minutas/regulamento-cliente-beta-2026-09-13.md` (+ .docx) | Minuta do regulamento |
| `cliente-beta/minutas/revisao-brandao-2026-09-13.md` | Revisão jurídica interna |
| `cliente-beta/minutas/verificacao-publicacao-daniel-2026-09-13.md` | Verificação técnica antes de publicar |
| `cliente-beta/publicacao/` (README, aviso, regulamento) | Textos finais preparados para publicar |
| `cliente-beta/implementacao/ambiente-local.md` | Ambiente local de testes |
| `cliente-beta/implementacao/fecho-beta-proposta.sql` | Proposta SQL de fecho da beta |
| `spec-registo-beta-testers-2026-08-25.md` | Brief original do registo `/beta` |
| `copy-beta-testers-2026-08-27.md` | Copy da página `/beta` |
| `codigos-campanha-beta-2026-08-25.md` | Registo de códigos de campanha (`via`) |
| `consentimentos/beta-2026-08-28.v1.txt` | Texto do aviso v1 — **imutável** |

## Marketing, campanha de abertura, redes
| Ficheiro | O quê |
|---|---|
| `campanha-abertura-distribuicao-2026-08-25.md` | Plano de distribuição da campanha de abertura |
| `parecer-rita-brinde-campanha-abertura-2026-08-25.md` | Parecer da Rita sobre o brinde |
| `copy-redes-sociais-2026-08-25.md` | Copy para redes sociais |
| `prompts-design-redes-2026-08-25.md` | Prompts de design para posts |
| `criativos/handoff-sergio-marta-2026-09-18.md` (+ 7 png) | Handoff dos criativos beta, Sérgio → Marta |
| `SEO-diagnostico-2026-08-15.md` | Diagnóstico SEO |
| `SEO-revisao-completa-2026-08-15.md` | Revisão completa de SEO |
| `og/gerar-og.py` | Script das imagens Open Graph |
| `referencias/` (README + png) | Referências visuais do interior |

## Cozinha e ementa
| Ficheiro | O quê |
|---|---|
| `ementas/Parecer-Rita-Ementa-v1.md` | Parecer da Chef sobre a ementa finalizada |
| `ementas/PF-rotacao-semanal.md` | Rotação semanal do Prato Feito |
| `ementas/*.xlsx`, `*.pdf` | Ementa v2, fichas técnicas (23 pratos), lista de compras, livro de receitas, prompts de imagem |

## Tecnologia e segurança
| Ficheiro | O quê |
|---|---|
| `auditoria-seguranca-2026-08-27.md` | Auditoria de segurança pré-abertura |
| `pin/PENDENTE-pingate.md` | **Pendente** — fechar a exposição de `pin_hash` |
| `spec-gestor-colaboradores-2026-08-21.md` | Spec técnica do Gestor de Colaboradores |
| `fichero-ble-avaliacao-2026-08-21.md` | Avaliação do FICHERO 6181 por Bluetooth |
| `vendus-faturacao-parada.md` | Faturação Vendus — estado e conclusão |

## Legal e RGPD
| Ficheiro | O quê |
|---|---|
| `rgpd/2026-07-cronologia-exposicao-dados.md` | Cronologia da exposição de dados no `/cardapio` |
| `rgpd/2026-07-notificacao-cnpd-RASCUNHO.md` | Rascunho da notificação à CNPD (art. 33.º) |
| `rgpd/2026-07-aviso-clientes-RASCUNHO.md` | Rascunho da comunicação aos clientes (art. 34.º) |
| `legal/2026-07-30-comercio-eletronico-RASCUNHO.md` | Rascunho — requisitos legais do comércio electrónico |
| `perguntas-brandao-colaboradores-2026-08-21.md` | Questões ao Dr. Brandão sobre colaboradores |
