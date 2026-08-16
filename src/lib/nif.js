// Validação do NIF português.
//
// Até aqui pedia-se "nove dígitos" e dava-se por bom. Nove dígitos não é um
// NIF: é um número de telefone com sorte. A encomenda nº 7 passou no checkout
// com 260603471 — nove dígitos, dígito de controlo errado —, foi paga, e só
// falhou na Vendus depois do dinheiro entrar, quando já ninguém estava a olhar.
// A documentação da Vendus é explícita: "If client is portuguese, it must be a
// valid fiscal id". Mais vale recusar no formulário, com o cliente à frente.
//
// O último dígito é de controlo: soma-se cada um dos oito primeiros pelo seu
// peso (9 para o primeiro, 2 para o oitavo) e tira-se o módulo 11. Resto menor
// que 2 → controlo 0; caso contrário, 11 menos o resto.
export function nifValido(valor) {
  const n = String(valor ?? '').replace(/\D/g, '')
  if (!/^[1-9]\d{8}$/.test(n)) return false

  const soma = n
    .slice(0, 8)
    .split('')
    .reduce((acc, d, i) => acc + Number(d) * (9 - i), 0)

  const resto = soma % 11
  const controlo = resto < 2 ? 0 : 11 - resto
  return Number(n[8]) === controlo
}

// O NIF é quase sempre opcional — só tem de ser válido se for escrito. Evita
// repetir `nif === '' || nifValido(nif)` em cada formulário.
export const nifOpcionalValido = (valor) => {
  const n = String(valor ?? '').replace(/\D/g, '')
  return n === '' || nifValido(n)
}
