// Condições de venda à distância (restaurante online) — DL 24/2014.
// Texto VALIDADO por Brandão & Associados (parecer BA/2026/100P-02, 30/07/2026).
// Ainda NÃO em vigor: falta preencher os dados operacionais [a preencher] e
// resolver os bloqueadores de checkout (secção V do parecer: botão "obrigação
// de pagar", alergénios por item, verificação de idade, taxa/ prazo no carrinho,
// checkbox de aceitação, e-mail de confirmação). Por isso a página fica routed
// mas NÃO ligada no rodapé, com aviso de "não em vigor".
import { PaginaLegal, Seccao } from './PaginaLegal'

const SEO = {
  title: 'Condições de Venda | 100PRESSÃO',
  description:
    'Condições de venda à distância do restaurante online 100PRESSÃO: entrega, pagamento, direitos do consumidor e resolução de litígios.',
}

// Marca um dado operacional ainda por preencher.
const Falta = ({ children }) => (
  <strong className="rounded bg-ambar-500/15 px-1 text-ambar-700">[{children}]</strong>
)

function CondicoesVenda() {
  return (
    <PaginaLegal titulo="Condições de Venda" atualizado="validado · pendente entrada em vigor" seo={SEO}>
      <div
        role="status"
        className="rounded-xl border border-ambar-500/50 bg-ambar-500/10 px-4 py-3 text-sm font-semibold text-grafite-900"
      >
        Texto validado juridicamente. Ainda não está em vigor — faltam preencher os dados
        assinalados e concluir os requisitos do checkout do restaurante online.
      </div>

      <p className="leading-relaxed text-grafite-600">
        Estas condições aplicam-se às encomendas feitas à distância no restaurante online do
        100PRESSÃO, para entrega ao domicílio ou levantamento. As compras no estabelecimento
        (ao balcão ou à mesa) regem-se pelas condições gerais afixadas no local. Aplica-se a
        cada encomenda a versão destas condições em vigor no momento em que a confirmas.
      </p>

      <Seccao titulo="1. Identificação">
        <p>
          Sintonia dos Temperos, Lda., sociedade por quotas com sede na Praceta Eugénio de
          Castro, Loja 6, 2790-072 Carnaxide, que explora o estabelecimento "100PRESSÃO —
          Draft House".
        </p>
        <p className="mt-2">
          NIPC e matrícula n.º 519521463 na Conservatória do Registo Comercial de Oeiras.
          Capital social: 5000 €, integralmente realizado.
        </p>
        <p className="mt-2">
          Telefone: +351 935 995 011 · E-mail:{' '}
          <a href="mailto:geral@100pressao.pt" className="text-cobre-600 underline-offset-4 hover:underline">
            geral@100pressao.pt
          </a>
        </p>
      </Seccao>

      <Seccao titulo="2. Como se forma o contrato">
        <p>
          Ao concluíres a encomenda estás a apresentar-nos uma proposta de compra. O contrato
          considera-se celebrado quando te enviarmos, por e-mail, a confirmação da encomenda —
          que inclui o detalhe do pedido, o preço final e uma cópia destas condições.
        </p>
        <p className="mt-2">
          Podemos não conseguir aceitar um pedido (por exemplo, item esgotado, morada fora da
          área de entrega ou capacidade de cozinha esgotada). Nesse caso informamos-te de
          imediato e devolvemos integralmente qualquer valor já pago, pelo mesmo meio de
          pagamento que utilizaste.
        </p>
      </Seccao>

      <Seccao titulo="3. Preços e pagamento">
        <p>
          Os preços estão em euros e incluem IVA à taxa legal em vigor — 13% nas refeições,
          águas, cafés e chás, e 23% nas bebidas alcoólicas, refrigerantes, sumos, néctares e
          águas gaseificadas. O preço final da tua encomenda, incluindo a taxa de entrega, é-te
          apresentado no carrinho antes de concluíres o pedido.
        </p>
        <p className="mt-2">
          Podes pagar online por MB Way, Multibanco ou cartão, através do prestador de
          pagamentos IfThenPay, ou no ato da entrega ou levantamento. Não recolhemos nem
          guardamos os dados do teu cartão: são tratados diretamente pelo prestador de
          pagamentos em ambiente seguro.
        </p>
      </Seccao>

      <Seccao titulo="4. Entrega e levantamento">
        <p>
          Entregamos em Carnaxide e na área envolvente, num raio máximo de 12 km a partir da
          loja. Se a tua morada estiver fora desta área, informamos-te antes de concluíres o
          pedido.
        </p>
        <p className="mt-2">
          A entrega é gratuita até 2 km. Acima disso, aplica-se uma taxa base de 1,60 € mais
          0,90 € por cada quilómetro adicional (calculado pela distância até à morada indicada),
          até ao raio máximo de 12 km. O valor exato é-te mostrado no carrinho antes do
          pagamento. A encomenda mínima para entrega é de 20 €.
        </p>
        <p className="mt-2">
          As refeições são preparadas na hora e entregues ou levantadas no próprio dia, no
          prazo máximo de 20 minutos a contar da confirmação da encomenda, salvo indicação
          diferente comunicada no momento do pedido.
        </p>
        <p className="mt-2">
          Se não cumprirmos esse prazo, podes fixar-nos um prazo suplementar adequado; se
          também esse não for cumprido, podes resolver o contrato e receber o reembolso
          integral do que tiveres pago.
        </p>
      </Seccao>

      <Seccao titulo="5. Direito de livre resolução">
        <p>
          Nas compras à distância existe, em regra, um direito de livre resolução de 14 dias.
          Esse direito não se aplica às encomendas de refeições e bebidas preparadas ou
          servidas pelo 100PRESSÃO, nos termos do artigo 17.º, n.º 1, alíneas d) e k), do
          Decreto-Lei n.º 24/2014, de 14 de fevereiro — por se tratar de bens perecíveis, que
          não podem ser reenviados, e de serviços de restauração com período de execução
          específico.
        </p>
        <p className="mt-2">
          Isto significa que, depois de confirmada, não podes devolver uma refeição por teres
          mudado de ideias. Não afeta, porém, nenhum dos teus outros direitos: se o pedido
          chegar errado, incompleto ou em más condições, ou se não conseguirmos entregá-lo,
          aplica-se o ponto 6.
        </p>
      </Seccao>

      <Seccao titulo="6. Se o pedido não estiver conforme">
        <p>
          Se algo não corresponder ao que encomendaste, contacta-nos no mesmo dia para{' '}
          <a href="mailto:geral@100pressao.pt" className="text-cobre-600 underline-offset-4 hover:underline">
            geral@100pressao.pt
          </a>{' '}
          ou +351 935 995 011, se possível com fotografia. Consoante a situação, repomos o
          item, substituímo-lo, reduzimos o preço ou reembolsamos-te. Este procedimento não
          prejudica os prazos e direitos que a lei te confere enquanto consumidor.
        </p>
      </Seccao>

      <Seccao titulo="7. Cancelamento e reembolsos">
        <p>
          Podes cancelar a encomenda sem qualquer custo enquanto a preparação não tiver
          começado — para isso, contacta-nos assim que possível. Depois de iniciada a
          preparação, e por se tratar de comida confecionada a pedido, o cancelamento pode já
          não ser possível.
        </p>
        <p className="mt-2">
          Os reembolsos são processados pelo mesmo meio de pagamento que utilizaste, no prazo
          máximo de 14 dias. Se não estiveres na morada indicada no momento da entrega e não
          for possível contactar-te, a encomenda fica disponível para levantamento na loja até
          ao fecho do serviço, não havendo lugar a reembolso.
        </p>
      </Seccao>

      <Seccao titulo="8. Alergénios e informação alimentar">
        <p>
          A informação sobre alergénios de cada prato está disponível no menu online, antes de
          concluíres a encomenda, e pode ser pedida a qualquer momento pelos nossos contactos.
        </p>
        <p className="mt-2">
          A nossa cozinha manipula, entre outros, glúten, ovo, leite, frutos de casca rija,
          soja, peixe, crustáceos, moluscos, aipo, mostarda, sementes de sésamo, tremoço e
          dióxido de enxofre. Apesar dos cuidados de separação, não podemos garantir a ausência
          total de vestígios por contaminação cruzada. Se tiveres uma alergia ou intolerância,
          indica-o no campo de observações da encomenda ou contacta-nos antes de encomendar.
        </p>
      </Seccao>

      <Seccao titulo="9. Bebidas alcoólicas">
        <p>
          A venda de bebidas alcoólicas é proibida a menores de 18 anos. Se a tua encomenda
          incluir bebidas alcoólicas, confirmas no momento do pedido que tens 18 anos ou mais.
        </p>
        <p className="mt-2">
          No ato da entrega ou levantamento podemos solicitar documento de identificação. Se a
          maioridade não for comprovada, não entregamos a componente alcoólica da encomenda e
          reembolsamos o respetivo valor, mantendo-se a entrega dos restantes artigos e a taxa
          de entrega.
        </p>
      </Seccao>

      <Seccao titulo="10. Reclamações e resolução de litígios">
        <p>
          Podes apresentar reclamação em qualquer altura para{' '}
          <a href="mailto:geral@100pressao.pt" className="text-cobre-600 underline-offset-4 hover:underline">
            geral@100pressao.pt
          </a>{' '}
          ou através do Livro de Reclamações, disponível em formato físico na loja e em formato
          eletrónico em{' '}
          <a href="https://www.livroreclamacoes.pt/" target="_blank" rel="noopener noreferrer" className="text-cobre-600 underline-offset-4 hover:underline">
            livroreclamacoes.pt
          </a>.
        </p>
        <p className="mt-3">
          Em caso de litígio de consumo, podes recorrer à seguinte entidade de Resolução
          Alternativa de Litígios (RAL), territorialmente competente para a nossa área:
        </p>
        <p className="mt-2">
          <strong>Centro de Arbitragem de Conflitos de Consumo de Lisboa (CACCL)</strong>
          <br />
          Rua dos Douradores, n.º 116, 2.º — 1100-207 Lisboa
          <br />
          Tel. 218 807 030 ·{' '}
          <a href="https://www.centroarbitragemlisboa.pt" target="_blank" rel="noopener noreferrer" className="text-cobre-600 underline-offset-4 hover:underline">
            centroarbitragemlisboa.pt
          </a>
        </p>
        <p className="mt-2">
          Mais informação sobre os teus direitos enquanto consumidor em{' '}
          <a href="https://www.consumidor.gov.pt" target="_blank" rel="noopener noreferrer" className="text-cobre-600 underline-offset-4 hover:underline">
            consumidor.gov.pt
          </a>.
        </p>
      </Seccao>

      <Seccao titulo="11. Proteção de dados">
        <p>
          O tratamento dos teus dados pessoais — nome, contacto e morada de entrega — rege-se
          pela nossa{' '}
          <a href="/privacidade" className="text-cobre-600 underline-offset-4 hover:underline">
            Política de Privacidade
          </a>.
        </p>
      </Seccao>

      <Seccao titulo="12. Lei aplicável">
        <p>
          Estas condições regem-se pela lei portuguesa, sem prejuízo dos direitos que te
          assistem enquanto consumidor.
        </p>
      </Seccao>
    </PaginaLegal>
  )
}

export default CondicoesVenda
