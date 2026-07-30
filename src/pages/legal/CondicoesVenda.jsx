// Condições de venda à distância (restaurante online) — DL 24/2014.
// RASCUNHO: rota ativa mas NÃO ligada no rodapé até validação jurídica do
// Brandão. Ver docs/legal/2026-07-30-comercio-eletronico-RASCUNHO.md.
// As notas "(a validar/confirmar)" marcam o que falta fechar antes de publicar.
import { PaginaLegal, Seccao } from './PaginaLegal'

const SEO = {
  title: 'Condições de Venda | 100PRESSÃO',
  description:
    'Condições de venda à distância do restaurante online 100PRESSÃO: entrega, pagamento, direitos do consumidor e resolução de litígios.',
}

const Nota = ({ children }) => (
  <em className="text-grafite-600/60"> ({children})</em>
)

function CondicoesVenda() {
  return (
    <PaginaLegal titulo="Condições de Venda" atualizado="rascunho · 30/07/2026" seo={SEO}>
      <div
        role="status"
        className="rounded-xl border border-ambar-500/50 bg-ambar-500/10 px-4 py-3 text-sm font-semibold text-grafite-900"
      >
        Documento em preparação, a aguardar validação jurídica. Ainda não está em vigor.
      </div>

      <p className="leading-relaxed text-grafite-600">
        Estas condições aplicam-se às encomendas feitas à distância no restaurante
        online do 100PRESSÃO, para entrega ao domicílio ou levantamento. As compras
        no estabelecimento (ao balcão / à mesa) regem-se pelas condições gerais.
      </p>

      <Seccao titulo="1. Identificação">
        <p>
          <strong>Sintonia dos Temperos, Lda.</strong> (estabelecimento "100PRESSÃO — Draft House")
          <br />
          NIF/NIPC: 519521463
          <br />
          Praceta Eugénio de Castro, Loja 6, 2790-072 Carnaxide
          <br />
          Telefone: +351 935 995 011 · E-mail:{' '}
          <a href="mailto:geral@100pressao.pt" className="text-cobre-600 underline-offset-4 hover:underline">
            geral@100pressao.pt
          </a>
        </p>
      </Seccao>

      <Seccao titulo="2. Encomendas">
        <p>
          Ao confirmar a encomenda, celebras um contrato de compra connosco. Podemos
          não conseguir satisfazer um pedido (por exemplo, item esgotado ou fora da
          área de entrega) e, nesse caso, informamos-te e devolvemos qualquer valor
          já pago.
        </p>
      </Seccao>

      <Seccao titulo="3. Preços e pagamento">
        <p>
          Os preços são em euros, com IVA incluído<Nota>menção de IVA a validar</Nota>. Aos
          pedidos com entrega acresce a taxa de entrega (ver ponto 4). O pagamento pode
          ser feito online por <strong>MB Way, Multibanco ou cartão</strong>, através do
          prestador de pagamentos <strong>IfThenPay</strong>, ou no ato da entrega/levantamento.
          Não guardamos dados do teu cartão.
        </p>
      </Seccao>

      <Seccao titulo="4. Entrega e levantamento">
        <p>
          Entregamos na área envolvente da loja, em Carnaxide<Nota>raio máximo a definir</Nota>.
          A entrega é <strong>gratuita até 2 km</strong>; acima disso, <strong>0,80 €/km</strong>,
          calculado pela distância até à morada indicada. A <strong>encomenda mínima para
          entrega é de 20 €</strong>. Tratando-se de refeições preparadas na hora, a entrega
          ou o levantamento ocorrem no próprio dia, num prazo estimado que te é indicado ao
          confirmar o pedido<Nota>prazo a definir</Nota>.
        </p>
      </Seccao>

      <Seccao titulo="5. Direito de livre resolução">
        <p>
          Por se tratar de <strong>bens perecíveis e de refeições preparadas a pedido</strong>,
          e nos termos do artigo 17.º do Decreto-Lei n.º 24/2014, <strong>não é aplicável o
          direito de livre resolução</strong> (devolução em 14 dias) às encomendas de comida e
          bebida. Se algo não estiver conforme, contacta-nos de imediato para resolvermos.
          <Nota>redação e aplicação da exceção a validar juridicamente</Nota>
        </p>
      </Seccao>

      <Seccao titulo="6. Reclamações e resolução de litígios">
        <p>
          Podes apresentar reclamação em qualquer altura para{' '}
          <a href="mailto:geral@100pressao.pt" className="text-cobre-600 underline-offset-4 hover:underline">
            geral@100pressao.pt
          </a>{' '}
          ou no <strong>Livro de Reclamações</strong> (físico na loja e eletrónico em{' '}
          <a href="https://www.livroreclamacoes.pt/" target="_blank" rel="noopener noreferrer" className="text-cobre-600 underline-offset-4 hover:underline">
            livroreclamacoes.pt
          </a>).
        </p>
        <p className="mt-3">
          Em caso de litígio de consumo, podes recorrer a uma entidade de Resolução
          Alternativa de Litígios (RAL): <strong>(entidade competente a indicar)</strong>
          <Nota>entidade RAL a confirmar — ex.: Centro de Arbitragem de Conflitos de Consumo de Lisboa ou CNIACC</Nota>.
          Mais informação em{' '}
          <a href="https://www.consumidor.gov.pt" target="_blank" rel="noopener noreferrer" className="text-cobre-600 underline-offset-4 hover:underline">
            consumidor.gov.pt
          </a>. Para compras online, existe ainda a plataforma europeia de resolução de
          litígios em{' '}
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-cobre-600 underline-offset-4 hover:underline">
            ec.europa.eu/consumers/odr
          </a>.
        </p>
      </Seccao>

      <Seccao titulo="7. Bebidas alcoólicas">
        <p>
          A venda de bebidas alcoólicas destina-se a maiores de idade, nos termos da lei.
          Podemos recusar a entrega quando tal não se verifique.
        </p>
      </Seccao>

      <Seccao titulo="8. Proteção de dados">
        <p>
          O tratamento dos teus dados pessoais (nome, contacto e morada de entrega) rege-se
          pela nossa{' '}
          <a href="/privacidade" className="text-cobre-600 underline-offset-4 hover:underline">
            Política de Privacidade
          </a>.
        </p>
      </Seccao>

      <Seccao titulo="9. Lei aplicável">
        <p>
          Estas condições regem-se pela lei portuguesa, sem prejuízo dos teus direitos
          enquanto consumidor.
        </p>
      </Seccao>
    </PaginaLegal>
  )
}

export default CondicoesVenda
