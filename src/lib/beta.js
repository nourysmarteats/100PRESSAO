// Beta testers — regras do registo público em /beta.
//
// Funções puras, como em candidaturas.js, porque estas decisões precisam de
// ser lidas e discutidas sem abrir um ecrã. Em especial esta:
//
//   A ORIGEM É CAPTADA DUAS VEZES E AS DUAS SÃO GRAVADAS.
//
// O parâmetro do URL diz por que peça a pessoa entrou. A pergunta no
// formulário diz o que a pessoa julga que a trouxe. Não são a mesma coisa e
// nenhuma substitui a outra: o parâmetro perde-se quando alguém escreve o
// endereço à mão, tira print e reenvia, ou copia o link para o WhatsApp. É a
// diferença entre os dois que diz se os QR estão a ser lidos.
//
// NOME DO PARÂMETRO: o site já usava `via` (ver admin/QrCode.jsx, que gera
// `?via=saco`, e analytics.js, que o manda para o GA no page_location). O
// brief pedia `?o=`. Ficou `via` como canónico, para não haver dois
// vocabulários de origem no mesmo site — e `o` continua a ser lido, para o
// caso de já ter saído alguma peça impressa com ele.

export const CONFIG_FALLBACK = {
  aberto: false,
  aviso_versao: '',
  origens: ['amigo-familia', 'alguem-mercado', 'vi-mercado', 'redes-bairro', 'outro'],
}

// Rótulos do dropdown "Como soube de nós?", fixados pela Marta. As chaves têm
// de existir em definicoes.beta.origens — a base de dados recusa o que não
// estiver lá.
//
// Não há opção "cartaz com QR", e a ausência é deliberada. Sobrepunha-se a "vi
// no mercado", porque o cartaz está no mercado, e duplicava o que o parâmetro
// do URL já mede com precisão que o dropdown nunca terá. Só há cinco lugares e
// uma opção ambígua não estraga só a sua linha: estraga o cruzamento inteiro.
//
// A linha entre "alguém do mercado" e "vi a loja ou um cartaz" é pessoa contra
// coisa. É o caso em que o parâmetro falha quase sempre: não há link nenhum na
// frase "vão abrir ali, olha".
//
// "Outra coisa" fica em último de propósito: a primeira opção de um dropdown é
// sistematicamente sobre-escolhida. Nenhuma é pré-seleccionada.
export const ROTULOS_ORIGEM = {
  'amigo-familia': 'Um amigo ou familiar',
  'alguem-mercado': 'Alguém do mercado',
  'vi-mercado': 'Vi a loja ou um cartaz no mercado',
  'redes-bairro': 'Redes sociais ou grupo do bairro',
  outro: 'Outra coisa',
}

export const ORIGEM_DIRECTO = 'directo'
export const ORIGEM_INVALIDA = 'invalido'

// Formato aceite para o código de campanha. Cartazes impressos com acentos,
// espaços ou maiúsculas gravam 'invalido' — e uma peça que grava 'invalido'
// é uma peça cega. Quem imprime tem de saber isto antes de imprimir.
const CODIGO = /^[a-z0-9-]{1,40}$/

export function config(bruto) {
  if (!bruto || typeof bruto !== 'object') return CONFIG_FALLBACK
  return {
    ...CONFIG_FALLBACK,
    ...bruto,
    origens: Array.isArray(bruto.origens) && bruto.origens.length
      ? bruto.origens
      : CONFIG_FALLBACK.origens,
  }
}

export function origensDeclaradas(cfg) {
  return config(cfg).origens.map((id) => ({ id, rotulo: ROTULOS_ORIGEM[id] || id }))
}

// Lê a origem da query string. `via` primeiro, `o` como herança.
// Nunca devolve vazio: ausência é 'directo', lixo é 'invalido'. Os dois são
// respostas, não falhas — e distingui-los é o que permite saber se alguém
// andou a inventar códigos.
export function origemDoUrl(search) {
  const p = new URLSearchParams(search || '')
  const bruto = (p.get('via') ?? p.get('o') ?? '').trim().toLowerCase()
  if (!bruto) return ORIGEM_DIRECTO
  return CODIGO.test(bruto) ? bruto : ORIGEM_INVALIDA
}

// O telemóvel é o único identificador que temos. Guardado só com dígitos,
// para que "912 345 678" e "912345678" sejam a mesma pessoa e não duas.
export function normalizarTelemovel(valor) {
  return String(valor || '').replace(/\D/g, '')
}

// As mesmas regras existem em CHECK e na RPC. Aqui é só para o aviso chegar
// antes do erro — nunca para substituir a validação do servidor.
export function validar(dados, cfg) {
  const erros = []
  const nome = String(dados.nome || '').trim()
  if (nome.length < 2 || nome.length > 80) erros.push('Falta o nome.')

  const tel = normalizarTelemovel(dados.telemovel)
  if (!/^\d{9}$/.test(tel)) erros.push('O telemóvel tem de ter 9 dígitos.')

  const validas = config(cfg).origens
  if (!validas.includes(dados.origem_declarada)) erros.push('Diz-nos como soubeste de nós.')

  // Não é consentimento: é a confirmação de que o aviso do artigo 13.º foi
  // lido. A base legal da inscrição é a alínea b) — diligências a pedido do
  // titular. Continua a bloquear, porque sem esta caixa não há prova de que a
  // informação foi prestada no momento da recolha.
  if (!dados.aviso_lido) erros.push('Falta confirmar a leitura do aviso.')
  return erros
}

// Três dígitos com zeros à esquerda, para o cartão. É apresentação e mais
// nada: na base de dados o número é inteiro. Passados os 999 passa a haver
// quatro dígitos, que é o comportamento certo — vale mais um cartão feio do
// que dois beta testers com o mesmo número.
export function numeroFormatado(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) return '000'
  return String(Math.trunc(v)).padStart(3, '0')
}

// ── Export ──

export const COLUNAS_EXPORT = [
  'numero', 'nome', 'telemovel', 'origem_param', 'origem_declarada',
  'criado_em', 'aviso_lido_em', 'aviso_versao',
  'contacto_pos_beta', 'contacto_pos_beta_em', 'ultima_interacao_em',
  'vaga', 'estado', 'expira_em',
]

function celula(valor) {
  const s = valor === null || valor === undefined ? '' : String(valor)
  return `"${s.replace(/"/g, '""')}"`
}

// Ponto-e-vírgula e BOM porque isto abre no Excel em português. Com vírgula,
// o Excel PT mete a linha toda numa célula; sem BOM, come os acentos.
export function csv(linhas, colunas = COLUNAS_EXPORT) {
  const cabecalho = colunas.join(';')
  const corpo = linhas.map((l) =>
    colunas.map((c) => celula(c === 'numero' ? numeroFormatado(l[c]) : l[c])).join(';'),
  )
  return `\ufeff${[cabecalho, ...corpo].join('\r\n')}\r\n`
}

// ── Leitura por origem ──

// Agrupa por origem declarada e conta quantos chegaram sem parâmetro no URL.
// É esta percentagem que responde à única pergunta que a campanha faz: os QR
// estão a ser lidos, ou as pessoas estão a escrever o endereço à mão?
export function porOrigem(linhas) {
  const mapa = new Map()
  for (const l of linhas) {
    const chave = l.origem_declarada || 'sem-resposta'
    const acc = mapa.get(chave) || { origem: chave, total: 0, semParametro: 0, params: new Map() }
    acc.total += 1
    if (l.origem_param === ORIGEM_DIRECTO) acc.semParametro += 1
    acc.params.set(l.origem_param, (acc.params.get(l.origem_param) || 0) + 1)
    mapa.set(chave, acc)
  }
  return [...mapa.values()]
    .map((a) => ({
      ...a,
      rotulo: ROTULOS_ORIGEM[a.origem] || a.origem,
      pctSemParametro: a.total ? Math.round((a.semParametro / a.total) * 100) : 0,
      params: [...a.params.entries()].sort((x, y) => y[1] - x[1]),
    }))
    .sort((a, b) => b.total - a.total)
}
