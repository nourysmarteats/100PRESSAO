// Aviso de privacidade — primeira camada, à vista no momento da inscrição/adesão
// ao programa Cliente Beta. Art. 13.º do RGPD: informar quando os dados são
// recolhidos, e informar não é ter uma hiperligação no rodapé.
//
// Esta é a PRIMEIRA CAMADA (resumo dos factos essenciais). O texto completo é a
// segunda camada, em /legal/cliente-beta/aviso-2026-09-14.v1.txt (imutável).
// Conteúdo factual validado pela Bea Salgado; o tom/redacção final é do Sérgio,
// sem retirar nenhum elemento legal.

function Linha({ termo, children }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-widest text-ambar-600">{termo}</dt>
      <dd className="text-sm text-grafite-700">{children}</dd>
    </div>
  )
}

export default function AvisoClienteBetaCompacto() {
  return (
    <div>
      <dl className="space-y-3">
        <Linha termo="Responsável">
          Sintonia dos Temperos, entidade que opera o 100PRESSÃO Draft House.
          NIPC 519 521 463. Praceta Eugénio de Castro, Loja 6 e 7, 2790-063
          Carnaxide. Contacto: geral@100pressao.pt
        </Linha>

        <Linha termo="Finalidade">
          Gerir a tua inscrição e a adesão ao programa Cliente Beta: atribuir-te
          um número, colocar-te no lote, contactar-te sobre a abertura e, depois
          da inauguração, dar-te os benefícios de Cliente Beta.
        </Linha>

        <Linha termo="Fundamento">
          Inscrição e adesão ao programa: diligências e execução a teu pedido —
          artigo 6.º, n.º 1, alínea b) do RGPD. Não é consentimento. O contacto
          depois da beta é que assenta em consentimento (alínea a), é opcional e
          nunca vem pré-marcado.
        </Linha>

        <Linha termo="Que dados">
          Nome, telemóvel e a tua resposta a "Como soube de nós?". Guardamos
          também por que hiperligação chegaste aqui.
          <strong> Não te pedimos morada, data de nascimento, NIF nem dados de
          pagamento.</strong>
        </Linha>

        <Linha termo="Benefícios">
          Depois da inauguração da tua unidade: 10% de desconto no teu próprio
          consumo e acesso à ementa exclusiva, nos termos do regulamento.
          Durante a fase beta estes benefícios ainda não se aplicam.
        </Linha>

        <Linha termo="Quanto tempo">
          A inscrição fica até trinta dias depois da inauguração. A tua adesão
          ao programa dura enquanto fores Cliente Beta, com revisão a cada doze
          meses. Da saída do programa fica só uma prova mínima, sem nome nem
          contacto.
        </Linha>

        <Linha termo="Quem vê">
          Só a administração do 100PRESSÃO. A base de dados é privada, alojada na
          União Europeia, e não é partilhada nem vendida a terceiros.
        </Linha>

        <Linha termo="Os teus direitos">
          Acesso, rectificação, apagamento, limitação, oposição e portabilidade.
          Escreve para geral@100pressao.pt e respondemos em 30 dias. Podes também
          reclamar junto da CNPD ({'www.' + 'cnpd' + '.pt'}).
        </Linha>

        <Linha termo="Idade">
          O programa é para maiores de 18 anos — servimos bebidas alcoólicas.
        </Linha>
      </dl>

      <p className="mt-4 text-sm text-grafite-600/80">
        Este é o resumo. Podes ler o{' '}
        <a className="underline" href="/legal/cliente-beta/aviso-2026-09-14.v1.txt" target="_blank" rel="noreferrer">
          aviso de privacidade completo
        </a>{' '}
        antes de te inscreveres.
      </p>
    </div>
  )
}
