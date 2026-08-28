// Aviso de privacidade da inscricao na fase beta.
// Texto de Bea Salgado, versao 2026-08-28.v1, arquivado em
// docs/consentimentos/beta-2026-08-28.v1.txt.
//
// TEXTO PUBLICADO E IMUTAVEL. Nao se corrige aqui: cria-se a versao seguinte,
// arquiva-se o ficheiro novo, e sobe-se a etiqueta em definicoes.beta.aviso_versao.
// Se o texto mudar sem a etiqueta subir, os registos ja gravados passam a
// apontar para um texto que nao e o que a pessoa leu, e a prova deixa de existir.
//
// Art. 13.o do RGPD: informar no momento da recolha. Informar nao e ter uma
// hiperligacao em rodape, e o texto estar onde a pessoa escreve.

function Linha({ termo, children }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-widest text-ambar-600">{termo}</dt>
      <dd className="text-sm text-grafite-700">{children}</dd>
    </div>
  )
}

function AvisoPrivacidadeBeta({ compacto = false }) {
  return (
    <div className={compacto ? '' : 'space-y-4'}>
      {!compacto && (
        <p className="text-grafite-700">
          Quando te inscreves como beta tester, tratamos os teus dados pessoais
          nos termos que se seguem.
        </p>
      )}

      <dl className="space-y-3">
        <Linha termo="Responsável">
          Sintonia dos Temperos, entidade que opera o 100PRESSÃO Draft House.
          Praceta Eugénio de Castro, Loja 6, 2790-072 Carnaxide.
          Contacto: geral@100pressao.pt
        </Linha>

        <Linha termo="Finalidade">
          Gerir a tua inscrição como beta tester: atribuir-te um número,
          colocar-te num dos lotes e contactar-te para te dizer quando podes
          vir. Serve também para percebermos por que canal nos encontraste.
        </Linha>

        <Linha termo="Fundamento">
          Diligências a teu pedido — artigo 6.º, n.º 1, alínea b) do RGPD. Não
          é consentimento, e por isso não te pedimos nenhum: foste tu que te
          inscreveste. Podes sair quando quiseres e apagamos-te da lista.
        </Linha>

        <Linha termo="Que dados">
          Nome, telemóvel e a tua resposta a "Como soube de nós?". Guardamos
          também por que hiperligação chegaste a esta página, o que nos diz se
          veio de um QR, de uma publicação ou se escreveste o endereço à mão.
          <strong> Não te pedimos morada, data de nascimento, NIF nem dados de
          pagamento.</strong>
        </Linha>

        <Linha termo="Que mensagens te enviamos">
          Só sobre a beta: a confirmação, a convocatória do teu lote e
          alterações de data. Esta inscrição não te põe em nenhuma lista de
          promoções.
        </Linha>

        <Linha termo="Quanto tempo">
          Até trinta dias depois de a fase beta terminar, na inauguração. Se ao
          fim de doze meses a beta ainda não tiver terminado, perguntamos-te se
          queres continuar inscrito; se não responderes em trinta dias,
          apagamos-te.
        </Linha>

        <Linha termo="Quem vê">
          Só a administração do 100PRESSÃO. A lista fica em base de dados
          privada, com alojamento na União Europeia, e não é partilhada nem
          vendida a terceiros.
        </Linha>

        <Linha termo="Os teus direitos">
          Acesso, rectificação, apagamento, limitação, oposição e
          portabilidade. Escreve para geral@100pressao.pt e respondemos em 30
          dias. Podes também reclamar junto da CNPD ({'www.' + 'cnpd' + '.pt'}).
        </Linha>

        <Linha termo="Decisões automatizadas">
          Não há. Os lotes são decididos por pessoas.
        </Linha>

        <Linha termo="Idade">
          A beta é para maiores de 18 anos — servimos bebidas alcoólicas.
        </Linha>
      </dl>
    </div>
  )
}

export default AvisoPrivacidadeBeta
