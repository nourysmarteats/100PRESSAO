import { Link } from 'react-router-dom'
import AvisoPrivacidadeRecrutamento from '../../components/AvisoPrivacidadeRecrutamento'
import { PaginaLegal, Seccao } from './PaginaLegal'

const SEO = {
  title: 'Política de Privacidade | 100PRESSÃO',
  description:
    'Como o 100PRESSÃO recolhe, usa e protege os teus dados pessoais, ao abrigo do RGPD.',
}

const LINK = 'text-cobre-600 underline-offset-4 hover:underline'

function Privacidade() {
  return (
    <PaginaLegal titulo="Política de Privacidade" atualizado="27/09/2026" seo={SEO}>
      <p className="leading-relaxed text-grafite-600">
        Esta política explica que dados pessoais recolhemos quando usas este site,
        encomendas no restaurante online ou falas connosco, para que os usamos e
        quais os teus direitos, nos termos do Regulamento Geral sobre a Proteção de
        Dados (RGPD) e da legislação portuguesa aplicável.
      </p>

      <Seccao titulo="1. Quem é o responsável">
        <p>
          O responsável pelo tratamento dos dados é a <strong>Sintonia dos
          Temperos</strong> (NIPC 519 521 463), entidade que opera a marca
          100PRESSÃO Draft House, com morada na Praceta Eugénio de Castro, Loja 6,
          2790-063 Carnaxide. Para qualquer questão sobre os teus dados, contacta{' '}
          <a href="mailto:geral@100pressao.pt" className={LINK}>geral@100pressao.pt</a>.
        </p>
      </Seccao>

      <Seccao titulo="2. Que dados recolhemos e porquê">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Encomendas no restaurante online (entrega ou levantamento):</strong>{' '}
            nome, telemóvel, email, os artigos escolhidos, o método de pagamento e,
            se escolheres entrega, a morada. Com a morada calculamos a distância e o
            valor da entrega. Se pedires fatura com contribuinte, também o NIF.
            Pedimos ainda a confirmação de que tens 18 anos ou mais e a aceitação das
            Condições de Venda. Servem para preparar, cobrar, faturar e entregar a
            tua encomenda, e para te enviar a confirmação por email.
          </li>
          <li>
            <strong>Pagamentos:</strong> o pagamento online (MB WAY, Multibanco,
            cartão ou Pix) é feito no prestador de pagamentos. Para o MB WAY é usado
            o teu telemóvel; para o Pix, o teu CPF, que é enviado ao prestador e não
            fica guardado por nós. Nunca vemos nem guardamos os dados do teu cartão.
          </li>
          <li>
            <strong>Pedidos à mesa:</strong> quando pedes pela ementa digital no
            restaurante, recolhemos o nome que indicas, a mesa, os itens escolhidos
            e o método de pagamento preferido, apenas para servir o pedido.
          </li>
          <li>
            <strong>WhatsApp:</strong> se nos contactares pelo WhatsApp
            (+351 935 995 011), tratamos o teu número, o nome do teu perfil e o
            conteúdo das mensagens, para responder a pedidos de informação, apoiar
            encomendas e tratar reclamações. Se fores beta tester, é também por aqui
            que te enviamos os avisos da fase beta. Não usamos este canal para
            publicidade sem o teu consentimento.
          </li>
          <li>
            <strong>Feedback:</strong> se usares o formulário de opinião, guardamos a
            tua mensagem e, se os deres, o nome e o contacto, para te respondermos e
            melhorarmos o serviço.
          </li>
          <li>
            <strong>Navegação, estatísticas e publicidade:</strong> estatísticas de
            utilização (Google Analytics) e medição de publicidade (píxeis da Meta e
            do TikTok), <strong>apenas se aceitares</strong> no aviso de cookies, e
            cada finalidade em separado. Não enviamos a estas plataformas o teu
            nome, email ou telemóvel. Os detalhes estão na{' '}
            <Link to="/cookies" className={LINK}>Política de Cookies</Link>, onde
            podes mudar a tua escolha a qualquer momento.
          </li>
        </ul>
        <p>
          A inscrição como beta tester, o estatuto de Cliente Beta e as candidaturas
          a colaborador têm avisos próprios, apresentados no momento da inscrição
          (ver também o ponto 9).
        </p>
      </Seccao>

      <Seccao titulo="3. Com que base legal">
        <ul className="list-disc space-y-2 pl-5">
          <li>Encomendas, pagamentos, pedidos à mesa e respostas a pedidos teus: execução do contrato ou diligências a teu pedido.</li>
          <li>Faturação e conservação de documentos fiscais: cumprimento de obrigações legais.</li>
          <li>Feedback e reclamações: o nosso interesse legítimo em responder e melhorar.</li>
          <li>Avisos da fase beta: o consentimento que deste na inscrição.</li>
          <li>Estatísticas e píxeis de publicidade: o teu consentimento, que podes retirar a qualquer momento.</li>
        </ul>
      </Seccao>

      <Seccao titulo="4. Com quem partilhamos">
        <p>
          Não vendemos os teus dados. Recorremos a prestadores que os tratam por nossa
          conta e apenas para as finalidades acima:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Supabase</strong>: base de dados onde ficam as encomendas, os pedidos e o feedback (servidores na União Europeia).</li>
          <li><strong>Vercel</strong>: alojamento do site e do serviço que processa as encomendas.</li>
          <li><strong>ifthenpay</strong>: pagamentos por MB WAY, Multibanco, cartão e Pix.</li>
          <li><strong>Cegid Vendus</strong>: emissão e envio da fatura certificada.</li>
          <li><strong>Resend</strong>: envio do email de confirmação da encomenda.</li>
          <li><strong>Google (Maps)</strong>: cálculo da distância de entrega a partir da morada que indicas.</li>
          <li>
            <strong>WhatsApp Ireland Limited (Meta)</strong>: serviço de mensagens,
            quando nos contactas por WhatsApp. O WhatsApp trata também dados por conta
            própria, nos termos da sua{' '}
            <a href="https://www.whatsapp.com/legal/privacy-policy-eea" target="_blank" rel="noopener noreferrer" className={LINK}>
              política de privacidade
            </a>.
          </li>
          <li><strong>Google Analytics, Meta e TikTok</strong>: estatísticas e medição de publicidade, só com o teu consentimento.</li>
        </ul>
        <p>
          Se escolheres entrega, o estafeta que faz a entrega vê o teu nome, a morada
          e o telemóvel, apenas para te entregar a encomenda. Alguns prestadores podem
          tratar dados fora do Espaço Económico Europeu, com as garantias exigidas pelo
          RGPD (como cláusulas contratuais-tipo). O mapa da página Contactos usa
          OpenStreetMap, que não instala cookies de rastreio.
        </p>
      </Seccao>

      <Seccao titulo="5. Durante quanto tempo guardamos">
        <ul className="list-disc space-y-2 pl-5">
          <li>Encomendas e faturas: 10 anos, porque fazem parte da documentação contabilística que a lei nos obriga a conservar.</li>
          <li>Pedidos à mesa sem fatura associada: até 12 meses.</li>
          <li>Conversas de WhatsApp: até 12 meses depois do último contacto, salvo se forem precisas para uma reclamação em curso ou para cumprir uma obrigação legal.</li>
          <li>Feedback: até 2 anos.</li>
          <li>Estatísticas e píxeis: os prazos indicados na Política de Cookies.</li>
        </ul>
        <p>
          Podes pedir a eliminação dos teus dados a qualquer momento (ver ponto 6),
          exceto os que a lei nos obriga a conservar.
        </p>
      </Seccao>

      <Seccao titulo="6. Os teus direitos">
        <p>
          Tens o direito de aceder, corrigir, apagar, limitar ou opor-te ao
          tratamento dos teus dados, bem como o direito à portabilidade e a
          retirar o consentimento quando este seja a base do tratamento. Para
          exercer qualquer um destes direitos, escreve para{' '}
          <a href="mailto:geral@100pressao.pt" className={LINK}>geral@100pressao.pt</a>.
          Respondemos no prazo máximo de um mês.
        </p>
      </Seccao>

      <Seccao titulo="7. Reclamações">
        <p>
          Se entenderes que os teus dados não foram tratados de forma correta,
          podes apresentar uma reclamação à autoridade de controlo: em Portugal,
          a Comissão Nacional de Proteção de Dados (CNPD),{' '}
          <a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer" className={LINK}>
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

      <Seccao titulo="9. Beta testers, Cliente Beta e candidaturas">
        <p>
          A inscrição na fase beta em{' '}
          <Link to="/beta" className={LINK}>100pressao.pt/beta</Link> e a adesão ao
          estatuto de Cliente Beta têm avisos de privacidade próprios, apresentados no
          momento da inscrição e da adesão, com finalidade, base legal e prazos
          específicos.
        </p>
        <p>
          Se te candidatares a trabalhar connosco em{' '}
          <Link to="/colaborador" className={LINK}>100pressao.pt/colaborador</Link>
          , tratamos os teus dados nos termos abaixo:
        </p>
        <div className="mt-4">
          <AvisoPrivacidadeRecrutamento compacto />
        </div>
      </Seccao>

      <Seccao titulo="10. Alterações">
        <p>
          Podemos atualizar esta política sempre que necessário. A data no topo
          indica a última revisão.
        </p>
      </Seccao>
    </PaginaLegal>
  )
}

export default Privacidade
