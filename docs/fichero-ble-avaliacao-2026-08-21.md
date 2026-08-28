# FICHERO 6181 por Bluetooth — Avaliação Técnica

**Autor:** Daniel Cunha · **Data:** 2026-08-21 · **Estado:** 🟡 EM AVALIAÇÃO — decisão pendente

---

## TL;DR

A impressora está **operacional por USB** com o driver oficial. A pergunta em cima da mesa é se vale a pena fazê-la funcionar **sem fios**.

O protocolo BLE da FICHERO foi decifrado publicamente em Março de 2026 e está documentado com licença MIT. Isso derruba o custo de €1.500–3.500 para **2–3 horas de teste**. Mas persistem três incógnitas técnicas e uma limitação física que podem tornar o resultado inútil para o nosso caso de uso.

**Recomendação:** correr o teste de viabilidade (2–3h, custo zero) antes de comprometer qualquer desenvolvimento. Não avançar para integração sem o teste passar.

---

## Estado actual

| Item | Estado |
|---|---|
| Driver ShippingPrinter 3.1.4.500 | ✅ Instalado em `/Library/Printers/` |
| Fila de impressão macOS | ✅ Criada, modelo FICHERO 6181, sem funcionalidades genéricas |
| Ligação USB | ✅ Operacional |
| Ligação Bluetooth | ❌ Emparelha, nunca abre canal de impressão |

### Porque falha o Bluetooth

O macOS inclui um backend CUPS de Bluetooth (`/usr/libexec/cups/backend/bluetooth`), mas foi escrito para **Bluetooth Clássico** (perfis SPP/HCRP). A FICHERO 6181 é **BLE** (Bluetooth Low Energy, GATT) — protocolo diferente com o mesmo nome comercial.

O macOS fala BLE nativamente através do CoreBluetooth. O que não existe é a peça que liga o sistema de impressão a essa capacidade. Não falta uma língua; falta um tradutor.

---

## O que já sabemos do protocolo

Fonte: engenharia inversa pública da app Android oficial, publicada em Março de 2026 (licença MIT).

| Parâmetro | Valor |
|---|---|
| Serviço GATT | `000018f0-0000-1000-8000-00805f9b34fb` |
| Característica de escrita | `2af1` |
| Característica de notificação | `2af0` |
| Serviço alternativo | `0000ff00-…` (escrita `ff02`, notify `ff01`) |
| Query de modelo | `10 FF 20 F0` → devolve string ASCII |
| Família do 6181 | **AiYin** (documentado como "Fichero6181 / AiYin A4") |
| Enable (AiYin) | `10 FF FE 01` |
| Stop (AiYin) | `10 FF FE 45` |
| Cabeçalho de raster | `1D 76 30 mm xL xH yL yH` + dados |
| Codificação | 1 bit por pixel, MSB à esquerda, 1 = preto |

**Nota crítica:** as famílias AiYin e Lujiang usam comandos de enable/stop diferentes (`FE 01`/`FE 45` vs `F1 03`/`F1 45`). Com o par errado, **a impressora aceita os dados e não imprime — sem qualquer erro**. É a armadilha principal deste protocolo.

---

## As três incógnitas

A documentação pública cobre o modelo **D11s**, uma impressora de etiquetas de 96 px de largura. O nosso 6181 é A4. O que não sabemos:

**1. Largura do raster.** O D11s é fixo em 96 px (12 bytes por linha). O 6181 imprime A4. Pelo PPD instalado (página de 578 × 824 pontos), estimamos ~1630 pontos de largura, ou seja **~204 bytes por linha**. É uma estimativa, não um dado confirmado.

**2. Comandos de tipo de papel e densidade.** O D11s usa `10 FF 84 00`. Um modelo A4 com rolo diferente pode esperar outro valor.

**3. Fragmentação.** Uma página A4 completa dá cerca de **473 KB** de raster. Não sabemos se o firmware aceita o fluxo contínuo ou exige blocos com confirmação.

---

## A limitação física que ninguém contorna

Mesmo que tudo funcione, o BLE tem um tecto de débito de aproximadamente 5–20 KB/s em condições reais.

| Trabalho | Volume | Tempo estimado por BLE | Por USB |
|---|---|---|---|
| Etiqueta de delivery (60 × 40 mm) | ~2,4 KB | < 1 segundo | instantâneo |
| Página A4 completa | ~473 KB | **25 a 95 segundos** | 3–6 segundos |

**Conclusão:** o BLE é viável para etiquetas pequenas e inviável para documentos A4. Se o objectivo for imprimir guias de expedição em página inteira, o cabo não é uma limitação — é a única opção sensata.

---

## Plano de teste (spike)

Objectivo: responder às três incógnitas com custo zero antes de decidir.

| # | Passo | Tempo | Critério de sucesso |
|---|---|---|---|
| 1 | Ligar por BLE e enumerar serviços GATT | 15 min | Serviço `18f0` presente com característica `2af1` |
| 2 | Enviar `10 FF 20 F0` e ler resposta | 15 min | Devolve string de modelo legível |
| 3 | Imprimir raster de teste a 204 bytes/linha com enable/stop AiYin | 1–2 h | Sai impressão alinhada |
| 4 | Medir débito real com página cheia | 30 min | Tempo por página aceitável |

**Requisitos:** Python 3.10+ e a biblioteca `bleak` no Mac. O script corre no Terminal — não tenho acesso ao rádio Bluetooth a partir do ambiente de trabalho remoto.

**Se o passo 3 falhar**, o projecto encerra ali. Não vale a pena decompilar a app Android nós próprios.

---

## Cenários e custos

| Cenário | O que dá | Esforço | Risco de manutenção |
|---|---|---|---|
| **A — Nada** | FICHERO fica no cabo | 0 | Nenhum |
| **B — Serviço local BLE** | Dashboard Operacional imprime etiquetas sem fios | Spike 2–3 h + integração 1–2 dias | Baixo — código nosso, sem privilégios de root |
| **C — Backend CUPS** | Imprimir do Finder, Preview, qualquer app | 3–5 dias | **Alto** — corre como root, parte com actualizações do macOS |

O cenário C continua desaconselhado. O Tahoe tem partido impressão de terceiros a cada versão pontual; não quero essa dependência no arranque da operação.

---

## Recomendação

1. **Correr o spike.** Custo zero, resposta definitiva em duas ou três horas.
2. **Se passar, avaliar o cenário B** — e só se existir uma razão operacional real para cortar o cabo. Ter a impressora fixa junto ao posto de expedição, ligada por USB, resolve o mesmo problema por €0.
3. **Manter o cenário C fora de discussão.**

### O que isto não resolve

Esta avaliação é sobre **etiquetas de delivery**. Os talões de cozinha e os recibos do balcão continuam a exigir uma **térmica de rede de 80 mm** dedicada (ESC/POS na porta 9100, ~€107), que integra directamente no dashboard sem driver nenhum. Essa continua a ser a prioridade da checklist de arranque, e é independente desta decisão.

---

## Decisão pendente

**Leandro:** avanço com o spike, ou arquivamos e concentramos o esforço na térmica de rede?

---

## Referências

- Hackaday (2026-03-09) — *Reverse-Engineering the Bluetooth Fichero Thermal Label Printer Protocol*
- `github.com/0xMH/fichero-printer` — documentação de protocolo e implementação de referência (MIT)
- `blog.dbuglife.com/reverse-engineering-fichero-label-printer` — notas de engenharia inversa da app Android
- Certificado do instalador: Xiamen iprt Technology Co., Ltd (Apple Developer ID, válido até 2027-02-01)
