# Registo de subcontratantes (art. 28.º RGPD)

Responsável: **Sintonia dos Temperos** (NIPC 519 521 463), marca 100PRESSÃO Draft House.
Contacto RGPD: geral@100pressao.pt (equipa@ é alias).
Última revisão: 28/09/2026 — Bea Salgado / Daniel Cunha.

Cada fornecedor abaixo trata dados de clientes **por nossa conta**. Para cada um é preciso ter o
acordo de tratamento de dados (DPA) aceite ou assinado, e guardar o PDF nesta pasta
(`docs/rgpd/dpa/<fornecedor>.pdf`). Só o titular das contas (Leandro) o pode fazer.

| Fornecedor | Para quê | Dados | Local | DPA | Estado |
|---|---|---|---|---|---|
| Supabase | Base de dados, ficheiros | Todos os do site | UE (eu-west-3, Paris) | Pedir no painel da organização (secção legal / documentos) | ☐ por confirmar |
| Vercel | Alojamento do site e das funções | Tudo o que passa pelo site | Global | Procurar "DPA" nas páginas legais da Vercel; normalmente incorporado nos termos | ☐ por confirmar |
| ifthenpay | Pagamentos (MB WAY, Multibanco, cartão, Pix) | Telemóvel, valor, CPF (Pix) | Portugal | Ver se o contrato de adesão tem cláusula RGPD/subcontratação | ☐ por confirmar |
| Cegid Vendus | Faturação certificada | Nome, NIF, email, artigos | Portugal/UE | Ver termos/contrato Vendus (cláusula de tratamento de dados) | ☐ por confirmar |
| Resend | Email de confirmação | Nome, email, encomenda | EUA | Aceitar/descarregar o DPA nas definições ou páginas legais | ☐ por confirmar |
| Google (Maps Platform) | Distância da entrega | Morada | Global | Aceitar os termos de tratamento de dados na consola Google Cloud | ☐ por confirmar |
| WhatsApp (Meta) | Mensagens com clientes | Número, nome de perfil, mensagens | UE/Global | WhatsApp Business Terms (aceites ao usar a app) | ☑ incluído nos termos |

Não são subcontratantes deste registo (tratam com consentimento, por conta própria ou sem dados
pessoais): Google Analytics, píxeis Meta/TikTok (ver Política de Cookies), OpenStreetMap.

## Prazos de conservação e como são cumpridos

| Dados | Prazo (Política de Privacidade) | Como se cumpre |
|---|---|---|
| Encomendas online e faturas | 10 anos | Mantidas (obrigação fiscal) |
| Pedidos à mesa sem fatura | 12 meses | `expurgar_dados_operacionais()` — anonimiza, diário 03:45 |
| Feedback | 2 anos | `expurgar_dados_operacionais()` — apaga, diário 03:45 |
| Beta testers / Cliente Beta | Avisos próprios | `expurgar_beta_testers()`, `expurgar_clientes_beta()` |
| Candidaturas | 6/12 meses | `expurgar_candidaturas()` |
| Conversas de WhatsApp | 12 meses após o último contacto | **Manual** — revisão anual no telemóvel (lembrete na agenda) |
