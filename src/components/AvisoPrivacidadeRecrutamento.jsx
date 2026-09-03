// Aviso de privacidade do recrutamento.
//
// Vive num componente próprio porque tem de aparecer em dois sítios com o
// mesmo texto: no formulário de candidatura, à vista antes de submeter, e na
// política de privacidade. Duas versões do mesmo aviso acabam sempre por
// divergir, e a que diverge é a que alguém lê.
//
// O artigo 13.º do RGPD manda informar no momento da recolha. "Informar" não
// é ter uma hiperligação em rodapé — é o texto estar onde a pessoa escreve.

function Linha({ termo, children }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-widest text-ambar-600">{termo}</dt>
      <dd className="text-sm text-grafite-700">{children}</dd>
    </div>
  )
}

function AvisoPrivacidadeRecrutamento({ compacto = false }) {
  return (
    <div className={compacto ? '' : 'space-y-4'}>
      {!compacto && (
        <p className="text-grafite-700">
          Quando te candidatas a trabalhar connosco, tratamos os teus dados
          pessoais nos termos que se seguem.
        </p>
      )}

      <dl className="space-y-3">
        <Linha termo="Responsável">
          Sintonia dos Temperos, entidade que opera a marca 100PRESSÃO Draft
          House, com morada na Praceta Eugénio de Castro, Loja 6, 2790-063
          Carnaxide. Contacto: equipa@100pressao.pt
        </Linha>

        <Linha termo="Finalidade">
          Avaliar a tua candidatura e, se avançar, preparar a contratação.
        </Linha>

        <Linha termo="Fundamento">
          Diligências pré-contratuais a teu pedido — artigo 6.º, n.º 1,
          alínea b) do RGPD. Não é consentimento, e por isso não te pedimos
          nenhum: pediste-nos tu para te considerarmos.
        </Linha>

        <Linha termo="Que dados">
          Nome, contactos, função pretendida, disponibilidade, experiência e
          os anexos que carregares. <strong>Não te pedimos cópia do Cartão de
          Cidadão</strong>, nem NIF, NISS, IBAN ou morada — esses só fazem
          sentido depois de te escolhermos, e aí são recolhidos noutro
          momento. A identidade confirma-se pessoalmente, com o documento à
          frente, sem ficar cópia.
        </Linha>

        <Linha termo="Quanto tempo">
          Seis meses após a decisão. Se autorizares que fiquemos com a tua
          candidatura para futuras oportunidades, doze meses. Findo o prazo,
          apagamos registo e ficheiros — automaticamente, não por lembrança
          de alguém.
        </Linha>

        <Linha termo="Quem vê">
          Só a administração de 100PRESSÃO. Os ficheiros ficam em
          armazenamento privado e não são partilhados com terceiros.
          Alojamento na União Europeia.
        </Linha>

        <Linha termo="Os teus direitos">
          Acesso, rectificação, apagamento, limitação, oposição e
          portabilidade. Escreve para equipa@100pressao.pt e respondemos em
          30 dias. Podes também reclamar junto da CNPD.
        </Linha>

        <Linha termo="Decisões automatizadas">
          Não há. Ninguém é filtrado por um algoritmo — as candidaturas são
          lidas por pessoas.
        </Linha>
      </dl>
    </div>
  )
}

export default AvisoPrivacidadeRecrutamento
