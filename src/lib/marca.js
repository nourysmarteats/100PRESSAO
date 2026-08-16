// Fonte única de verdade para os dados da casa: morada, contactos, coordenadas,
// horário e redes sociais.
//
// Existe porque estes dados estavam espalhados por quatro sítios (index.html,
// Footer.jsx, Contacto.jsx, seo/pages.js) e já tinham divergido: o JSON-LD
// anunciava ao Google "2ª a 6ª, 08:00–12:00" enquanto a base de dados dizia
// 8:00–22:00 todos os dias. Em SEO local, a consistência do NAP (Name, Address,
// Phone) entre o site, o Google Business Profile e os directórios é um dos
// fatores que mais pesa — divergências penalizam.
//
// Regra: quem precisar destes valores importa-os daqui. Não voltar a escrevê-los
// à mão em lado nenhum.

export const SITE_URL = 'https://www.100pressao.pt'

export const MARCA = {
  nome: '100PRESSÃO',
  nomeCompleto: '100PRESSÃO Draft House',
  entidadeLegal: 'Sintonia dos Temperos',
  telefone: '+351935995011',
  telefoneFormatado: '935 995 011',
  email: 'geral@100pressao.pt',
}

export const MORADA = {
  rua: 'Praceta Eugénio de Castro, Loja 6',
  localidade: 'Carnaxide',
  codigoPostal: '2790-072',
  regiao: 'Oeiras',
  pais: 'PT',
}

// Coordenadas da loja. Vêm da tabela `definicoes` (chave `entrega`), onde são
// usadas para calcular o raio de entrega — ou seja, são as coordenadas
// operacionais reais, não uma geocodificação aproximada da morada.
export const GEO = {
  latitude: 38.7262329,
  longitude: -9.2369446,
}

export const MAPA_URL =
  'https://www.google.com/maps/place//data=!4m2!3m1!1s0xd1ecc607dc2c889:0x1946af38520f51d0'

// Horário confirmado pelo Leandro (15/08/2026) e coincidente com a tabela
// `definicoes` (chave `horario`): 8:00–22:00, sete dias por semana.
//
// Optámos por um bloco corrido em vez de janelas separadas por serviço. Se
// declarássemos "pequeno-almoço 8–11" e "almoço 12–15" como blocos distintos, o
// Google mostraria "Fechado" nos intervalos — e a casa está aberta e a servir
// cerveja. As janelas de serviço são explicadas em texto na ementa.
export const HORARIO = {
  abre: '08:00',
  fecha: '22:00',
  dias: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  legivel: 'Todos os dias, 8:00 – 22:00',
}

// Janelas de serviço — só para texto legível, nunca para o JSON-LD (ver acima).
export const SERVICOS = [
  { nome: 'Pequeno-almoço', horas: '8:00 – 11:30' },
  { nome: 'Almoço PF', horas: '12:00 – 15:00' },
  { nome: 'Petiscos e cerveja', horas: '15:00 – 22:00' },
]

// Perfis oficiais. Confirmados no código do Footer (já em produção).
//
// ATENÇÃO: existe um "100 PRESSÃO" no Funchal, com Instagram @100pressao.pt e
// página de Facebook própria, que NÃO tem relação com esta casa. É concorrência
// directa no nome da marca em pesquisas. Nunca acrescentar esses URLs ao
// `sameAs` — diria ao Google que somos a mesma entidade e misturaria os sinais
// de localização de Carnaxide com os da Madeira.
export const REDES_SOCIAIS = {
  instagram: 'https://www.instagram.com/100pressao2026',
  facebook: 'https://www.facebook.com/profile.php?id=61591461314419',
  tiktok: 'https://www.tiktok.com/@100pressao2026',
}

export const SAME_AS = Object.values(REDES_SOCIAIS)
