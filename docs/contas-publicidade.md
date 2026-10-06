# Contas de publicidade e redes — registo (sem palavras-passe)

Última atualização: 6 Out 2026 (Marta + Daniel; Google Ads acrescentado). **Nunca registar aqui palavras-passe, códigos 2FA ou dados de cartão.**

## Meta (Facebook + Instagram)

| Item | Valor |
|---|---|
| Login da Meta | Conta Facebook do Leandro (perfil "Leandro Borges"), email do domínio 100pressao.pt — caixa `geral@100pressao.pt` (`equipa@` é alias) |
| Portfólio empresarial | **100PRESSÃO** · ID `1066721642584286` · não verificado |
| Página Facebook | 100Pressão (ligada ao portfólio) |
| Instagram | @100pressao2026 (ligado à página) |
| Conta de anúncios | `100PRESSÃO – Ads` · ID `1522389476362191` · Europe/Lisbon · EUR · criada a 6 Out 2026 (termos aceites pelo Leandro) |
| Pixel | por criar — instalação manual pelo Daniel (`VITE_META_PIXEL_ID` no Vercel) |
| Faturação | **por configurar a 10 Out 2026** (ver secção abaixo) |

Pendentes no portfólio (vistos a 6 Out):
- Dados da empresa vazios (nome legal, morada, telefone, website) → preencher com os da Sintonia dos Temperos.
- Email de contacto do perfil vazio → `geral@100pressao.pt`.
- Autenticação de dois fatores: "Ninguém" → exigir a todos (recomendação Bea).
- Página principal: nenhuma → definir a página 100Pressão.
- Juntar a Neide como segunda administradora.
- Limite de criação de contas de anúncios: 1.

Atenção: no Chrome pessoal do Leandro existe outro portfólio com a página "Noury Smart Eats" (marca antiga). Não usar para anúncios.

## Pagamento da conta de anúncios Meta — marcado para 10 Out 2026

Verba aprovada: 300 € (teste 40 € · abertura 150 € · sustentação 80 € · reserva 30 €). Pagamento feito sempre pelo Leandro.

1. Abrir o Centro de Faturação: https://business.facebook.com/billing_hub/payment_settings/?asset_id=1522389476362191&business_id=1066721642584286
2. **Dados de faturação** (para as faturas virem com IVA para a empresa):
   - Nome: Sintonia dos Temperos
   - NIF/NIPC: 519521463
   - Morada: Praceta Eugénio de Castro, Loja 6 e 7, 2790-063 Carnaxide, Portugal
   - Email das faturas: geral@100pressao.pt
3. **Método de pagamento**: cartão da empresa, introduzido pelo Leandro (nunca pelos agentes).
4. **Limite de gastos da conta**: 300 € — impede gastar acima da verba aprovada.
5. Confirmar que a moeda aparece em EUR e o fuso Europe/Lisbon.

## TikTok

| Item | Valor |
|---|---|
| Conta | @100pressao2026 |
| TikTok Ads Manager | Conta de anunciante "SINTONIA DOS TEMPEROS, LDA_adv" · ID `7693477948116074517` · org `7693477805744652309` · EUR · Lisbon Time · criada a 6 Out 2026 |
| Login | geral@100pressao.pt (palavra-passe só com o Leandro); 2 passos por email e telemóvel |
| Dados | Setor "Quick service restaurant", Portugal, telefone +351 935 995 011, empresa encontrada no registo com a morada da Praceta Eugénio de Castro |
| Cupão | "H2'26 Seasonal %OFF": 50% de desconto no gasto até 45 € de crédito, **usar antes de 13 Out 2026** |
| Pagamento | por configurar a 10 Out 2026, junto com a Meta |
| Pixel | "100PRESSÃO site" · ID `DB2BQ7RC77U04C8M35UG` · só navegador (sem Events API) · criado a 6 Out 2026. Instalado a 6 Out 2026: `VITE_TIKTOK_PIXEL_ID` no Vercel (Production + Preview, tipo Config) e redeploy de produção. Testado em www.100pressao.pt: sem consentimento não carrega; depois de "Aceitar tudo" carrega o script do TikTok com este ID. Não colar o código-base do TikTok no site: o `src/lib/analytics.js` já o carrega, só com consentimento |

## Google Ads

| Item | Valor |
|---|---|
| Conta | **100PRESSÃO** · ID `815-644-3119` · criada a 6 Out 2026 **sem campanha** ("Configure apenas uma conta") |
| Login | nourysmarteats@gmail.com (palavra-passe só com o Leandro) |
| Definições fixas (não mudam depois) | País de faturação **Portugal** · fuso **(GMT+01:00) Hora de Portugal** · **EUR** — corrigidas antes de criar (o Google propunha Bélgica) |
| Destino dos anúncios | Site https://www.100pressao.pt/ (não a página do Perfil de Empresa) |
| Produtos associados | Canal YouTube 100PRESSÃO, Perfil de Empresa no Google (1 localização), telefone +351 935 995 011 — aprovado pelo Leandro |
| Perfil de pagamentos proposto | "Noury Draft House" · Organização · Portugal · ID `0768-8624-1008` — **verificar a 10 Out** se fica este ou se se cria um em nome da Sintonia dos Temperos |
| Pagamento | **por configurar a 10 Out 2026**: página `ads.google.com/aw/signup/payment` (aceitar os Termos do Google Ads, informações fiscais NIPC 519521463, cartão pelo Leandro) |
| Verba | não prevista nos 300 € do plano — não ativar campanhas sem decisão do Leandro |

Pendente: a morada do Perfil de Empresa diz só "Loja 6" — corrigir para "Loja 6 e 7".

## Outros
- WhatsApp Business: +351 935 995 011 (número do 100PRESSÃO desde 27 Set 2026).
- Metricool: ligado às redes da marca (gerido pelo Leandro/Marta).
