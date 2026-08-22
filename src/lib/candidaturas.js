// Candidaturas a colaborador — regras do portal público.
//
// Vive em funções puras porque estas decisões precisam de ser lidas, e
// discutidas, sem abrir um ecrã. Em especial esta:
//
//   QUE DOCUMENTOS SE EXIGEM DEPENDE DA FUNÇÃO, NÃO DO CANDIDATO.
//
// O comprovativo de início de atividade nas Finanças só existe para quem
// trabalha a recibos verdes. Exigi-lo a um candidato a cozinha seria decidir
// o vínculo antes da entrevista — e deixá-lo escrito num formulário público,
// que é a pior forma de o decidir. Por isso a via de cada função está na
// configuração, e é 100PRESSÃO que a define, nunca quem se candidata.
//
// A configuração real vem de definicoes.candidaturas e é editável no painel.
// O que está aqui é só o que fazer quando ela ainda não carregou.

export const CONFIG_FALLBACK = {
  portal_aberto: false,
  max_anexos: 3,
  funcoes: {
    cozinha: { rotulo: 'Cozinha', via: 'emprego', obrigatorios: [] },
    balcao: { rotulo: 'Balcão', via: 'emprego', obrigatorios: [] },
    sala: { rotulo: 'Sala', via: 'emprego', obrigatorios: [] },
    entregas: { rotulo: 'Entregas', via: 'emprego', obrigatorios: [] },
    servicos: {
      rotulo: 'Prestação de serviços',
      via: 'prestacao',
      obrigatorios: ['comprovativo_atividade'],
    },
    outra: { rotulo: 'Outra', via: 'emprego', obrigatorios: [] },
  },
}

// Lista fechada. Documentos de identificação não constam, e a ausência é
// deliberada: art. 5.º/2 da Lei 7/2007 e orientação da CNPD sobre reprodução
// do Cartão de Cidadão. A identidade confirma-se presencialmente.
export const TIPOS_DOCUMENTO = {
  curriculo: { rotulo: 'Currículo', dica: 'PDF, até 5 MB' },
  certificado_formacao: {
    rotulo: 'Certificado de formação',
    dica: 'ex.: higiene e segurança alimentar',
  },
  carta_conducao: { rotulo: 'Carta de condução', dica: 'só para entregas' },
  comprovativo_atividade: {
    rotulo: 'Comprovativo de início de atividade',
    dica: 'Declaração de Início de Atividade das Finanças',
  },
}

export const TIPOS_ACEITES_NO_PORTAL = Object.keys(TIPOS_DOCUMENTO)

export const MIME_ACEITES = ['application/pdf', 'image/jpeg', 'image/png']
export const TAMANHO_MAXIMO = 5 * 1024 * 1024

export function config(bruto) {
  if (!bruto || typeof bruto !== 'object') return CONFIG_FALLBACK
  return {
    ...CONFIG_FALLBACK,
    ...bruto,
    funcoes: { ...CONFIG_FALLBACK.funcoes, ...(bruto.funcoes || {}) },
  }
}

export function funcoes(cfg) {
  return Object.entries(config(cfg).funcoes).map(([id, f]) => ({ id, ...f }))
}

export function funcao(cfg, id) {
  return config(cfg).funcoes[id] || null
}

// Só a via de prestação de serviços pede comprovativo de atividade — e
// mesmo essa é configuração, não regra de código.
export function documentosObrigatorios(cfg, idFuncao) {
  const f = funcao(cfg, idFuncao)
  return Array.isArray(f?.obrigatorios) ? f.obrigatorios : []
}

export function documentosEmFalta(cfg, idFuncao, anexos = []) {
  const presentes = new Set(anexos.map((a) => a.tipo))
  return documentosObrigatorios(cfg, idFuncao).filter((t) => !presentes.has(t))
}

export function ficheiroAceite(ficheiro) {
  if (!ficheiro) return 'Ficheiro em falta.'
  if (!MIME_ACEITES.includes(ficheiro.type)) return 'Só PDF, JPEG ou PNG.'
  if (ficheiro.size > TAMANHO_MAXIMO) return 'O ficheiro passa os 5 MB.'
  if (ficheiro.size === 0) return 'O ficheiro está vazio.'
  return null
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// O mesmo conjunto de regras existe em CHECK na base de dados. Aqui é para
// o aviso chegar antes do erro.
export function validar(dados, cfg, anexos = []) {
  const erros = []
  if (!dados.nome || dados.nome.trim().length < 3) erros.push('Falta o nome.')
  if (!EMAIL.test(dados.email || '')) erros.push('O email não parece válido.')
  if (!funcao(cfg, dados.funcao_pretendida)) erros.push('Escolhe a função.')
  if (!dados.aviso_lido) erros.push('Falta confirmar a leitura do aviso de privacidade.')

  const max = config(cfg).max_anexos
  if (anexos.length > max) erros.push(`No máximo ${max} anexos.`)

  for (const t of documentosEmFalta(cfg, dados.funcao_pretendida, anexos)) {
    erros.push(`Falta o documento: ${TIPOS_DOCUMENTO[t]?.rotulo || t}.`)
  }
  return erros
}

// Nome de ficheiro vindo de um formulário público não entra num caminho de
// storage como veio. Fica o tipo, um id, e uma extensão da lista branca.
export function caminhoDocumento(candidaturaId, tipo, nomeOriginal = '', sufixo = '') {
  const ext = (String(nomeOriginal).match(/\.(pdf|jpe?g|png)$/i)?.[1] || 'bin').toLowerCase()
  const tipoLimpo = TIPOS_ACEITES_NO_PORTAL.includes(tipo) ? tipo : 'outro'
  const marca = String(sufixo).replace(/[^a-z0-9]/gi, '').slice(0, 12) || '0'
  return `${candidaturaId}/${tipoLimpo}-${marca}.${ext === 'jpeg' ? 'jpg' : ext}`
}

// Hash não-criptográfico de uma impressão do browser. Não identifica ninguém
// e não é o IP: só serve para o travão de submissões em catadupa notar que
// vieram todas do mesmo sítio. Falsificável, e é por isso que não é a única
// defesa — falta o Turnstile.
export function marcaCliente(semente) {
  let h = 2166136261
  for (const ch of String(semente)) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

export const ESTADOS_CANDIDATURA = {
  nova: 'Nova',
  em_analise: 'Em análise',
  entrevista: 'Entrevista',
  aceite: 'Aceite',
  recusada: 'Recusada',
  arquivada: 'Arquivada',
}
