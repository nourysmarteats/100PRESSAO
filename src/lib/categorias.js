// Tipo da categoria — decide que campos aparecem no cadastro de um produto.
//
// O formulário mostrava tudo a todos: um café expresso pedia estilo e ABV. Mas
// a divisão não é "cerveja / não cerveja". Estilo e ABV são mesmo só de
// cerveja; a origem é de comida (alimenta o sub-filtro português/brasileiro do
// cardápio); e os alergénios são dos dois — uma cerveja com trigo tem de os
// declarar tanto como um petisco.
//
// O tipo vive na tabela categories, não numa lista aqui, para que criar a
// categoria "Vinhos" se resolva no painel. Este ficheiro só diz o que cada tipo
// significa.

export const TIPOS_CATEGORIA = [
  {
    id: 'cerveja',
    rotulo: 'Cerveja',
    dica: 'Estilo e teor alcoólico, além dos alergénios.',
    campos: ['estilo', 'abv', 'alergenios'],
  },
  {
    id: 'comida',
    rotulo: 'Comida',
    dica: 'Origem (usada no filtro português/brasileiro) e alergénios.',
    campos: ['origem', 'alergenios'],
  },
  {
    id: 'bebida',
    rotulo: 'Bebida',
    dica: 'Sem campos específicos — refrigerantes, cafés, chás.',
    campos: [],
  },
  {
    id: 'outro',
    rotulo: 'Outro',
    dica: 'Sem campos específicos. Serve também para matéria-prima de stock.',
    campos: [],
  },
]

export const TIPO_PADRAO = 'outro'

export const tipoCategoria = (id) =>
  TIPOS_CATEGORIA.find((t) => t.id === id) || TIPOS_CATEGORIA.find((t) => t.id === TIPO_PADRAO)

export const rotuloTipo = (id) => tipoCategoria(id).rotulo

/**
 * Um campo mostra-se quando o tipo da categoria o prevê — ou quando já tem
 * valor, mesmo que não seja habitual ali.
 *
 * Esta segunda metade é o que torna a funcionalidade segura. Um campo escondido
 * com valor lá dentro continuaria a aparecer ao cliente no cardápio, sem
 * ninguém o poder corrigir: trocava-se um incómodo por um problema. Assim o
 * formulário limpa-se e nada se perde em silêncio.
 */
export const mostraCampo = (tipo, campo, valor) =>
  tipoCategoria(tipo).campos.includes(campo) || (valor !== '' && valor != null)

/** Campo preenchido que o tipo não prevê — merece uma nota, não um desaparecimento. */
export const campoForaDoTipo = (tipo, campo, valor) =>
  !tipoCategoria(tipo).campos.includes(campo) && valor !== '' && valor != null
