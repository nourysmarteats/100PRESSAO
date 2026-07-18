import { PaginaLegal, Seccao } from './PaginaLegal'

const SEO = {
  title: 'Política de Privacidade | 100PRESSÃO',
  description:
    'Como o 100PRESSÃO recolhe, usa e protege os teus dados pessoais, ao abrigo do RGPD.',
}

function Privacidade() {
  return (
    <PaginaLegal titulo="Política de Privacidade" atualizado="18/07/2026" seo={SEO}>
      <p className="leading-relaxed text-grafite-600">
        Esta política explica que dados pessoais recolhemos quando usas este site,
        para que os usamos e quais os teus direitos, nos termos do Regulamento
        Geral sobre a Proteção de Dados (RGPD) e da legislação portuguesa aplicável.
      </p>

      <Seccao titulo="1. Quem é o responsável">
        <p>
          O responsável pelo tratamento dos dados é a <strong>Sintonia dos
          Temperos</strong>, entidade que opera a marca 100PRESSÃO Draft House,
          com morada na Praceta Eugénio de Castro, Loja 6, 2790-072 Carnaxide.
          Para qualquer questão sobre os teus dados, contacta{' '}
          <a href="mailto:geral@100pressao.pt" className="text-cobre-600 underline-offset-4 hover:underline">
            geral@100pressao.pt
          </a>.
        </p>
      </Seccao>

      <Seccao titulo="2. Que dados recolhemos e porquê">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Pedidos à mesa:</strong> quando fazes um pedido pela ementa
            digital, recolhemos o nome que indicas, a mesa ou salão, os itens
            escolhidos e o método de pagamento preferido. Servem apenas para
            preparar e entregar o teu pedido.
          </li>
          <li>
            <strong>Feedback:</strong> se usares o formulário de opinião,
            guardamos a tua mensagem e, se os forneceres, o nome e o contacto,
            para te podermos responder e melhorar o serviço.
          </li>
          <li>
            <strong>Dados de navegação:</strong> estatísticas de utilização do
            site (Google Analytics), recolhidas <strong>apenas se aceitares</strong>{' '}
            no aviso de cookies. Ajudam-nos a perceber como o site é usado.
          </li>
        </ul>
        <p>
          Não pedimos nem guardamos dados de cartão. O pagamento é feito no
          local; o site apenas regista o método que preferes.
        </p>
      </Seccao>

      <Seccao titulo="3. Com que base legal">
        <ul className="list-disc space-y-2 pl-5">
          <li>Pedidos: execução do serviço que nos pediste.</li>
          <li>Feedback: o nosso interesse legítimo em responder e melhorar.</li>
          <li>Estatísticas de navegação: o teu consentimento (que podes retirar a qualquer momento).</li>
        </ul>
      </Seccao>

      <Seccao titulo="4. Com quem partilhamos">
        <p>
          Não vendemos os teus dados. Recorremos a prestadores de serviços que
          os tratam por nossa conta e apenas para as finalidades acima:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Supabase</strong>:base de dados onde ficam os pedidos e o feedback.</li>
          <li><strong>Vercel</strong>:alojamento e entrega do site.</li>
          <li><strong>Google Analytics</strong>:estatísticas de navegação (só com o teu consentimento).</li>
        </ul>
        <p>
          Alguns destes prestadores podem tratar dados fora do Espaço Económico
          Europeu, com as garantias exigidas pelo RGPD (como cláusulas
          contratuais-tipo). O mapa da página Contactos usa OpenStreetMap, que
          não instala cookies de rastreio.
        </p>
      </Seccao>

      <Seccao titulo="5. Durante quanto tempo guardamos">
        <p>
          Guardamos os dados apenas o tempo necessário às finalidades descritas
          e às obrigações legais (por exemplo, fiscais). Os prazos concretos de
          conservação estão a ser definidos e serão detalhados nesta política.
          Podes pedir a eliminação dos teus dados a qualquer momento (ver ponto 6).
        </p>
      </Seccao>

      <Seccao titulo="6. Os teus direitos">
        <p>
          Tens o direito de aceder, corrigir, apagar, limitar ou opor-te ao
          tratamento dos teus dados, bem como o direito à portabilidade e a
          retirar o consentimento quando este seja a base do tratamento. Para
          exercer qualquer um destes direitos, escreve para{' '}
          <a href="mailto:geral@100pressao.pt" className="text-cobre-600 underline-offset-4 hover:underline">
            geral@100pressao.pt
          </a>.
        </p>
      </Seccao>

      <Seccao titulo="7. Reclamações">
        <p>
          Se entenderes que os teus dados não foram tratados de forma correta,
          podes apresentar uma reclamação à autoridade de controlo: em Portugal,
          a Comissão Nacional de Proteção de Dados (CNPD),{' '}
          <a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer" className="text-cobre-600 underline-offset-4 hover:underline">
            www.cnpd.pt
          </a>.
        </p>
      </Seccao>

      <Seccao titulo="8. Menores">
        <p>
          Este site destina-se a maiores de idade, sobretudo por incluir bebidas
          alcoólicas. Não recolhemos intencionalmente dados de menores.
        </p>
      </Seccao>

      <Seccao titulo="9. Alterações">
        <p>
          Podemos atualizar esta política sempre que necessário. A data no topo
          indica a última revisão.
        </p>
      </Seccao>
    </PaginaLegal>
  )
}

export default Privacidade
