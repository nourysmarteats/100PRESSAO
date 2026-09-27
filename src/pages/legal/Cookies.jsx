import { PaginaLegal, Seccao } from './PaginaLegal'

const SEO = {
  title: 'Política de Cookies | 100PRESSÃO',
  description:
    'Que cookies e tecnologias semelhantes o site do 100PRESSÃO usa e como gerir o teu consentimento.',
}

function Cookies() {
  return (
    <PaginaLegal titulo="Política de Cookies" atualizado="27/09/2026" seo={SEO}>
      <p className="leading-relaxed text-grafite-600">
        Esta política explica que cookies e tecnologias semelhantes usamos neste
        site e como podes controlá-los.
      </p>

      <Seccao titulo="1. O que são cookies">
        <p>
          Cookies são pequenos ficheiros guardados no teu dispositivo quando
          visitas um site. Servem, por exemplo, para o site funcionar
          corretamente ou para recolher estatísticas de utilização.
        </p>
      </Seccao>

      <Seccao titulo="2. Que cookies usamos">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Essenciais (sempre ativos):</strong> necessários ao
            funcionamento do site, por exemplo para manter o teu pedido em
            curso na ementa digital e para guardar a tua escolha sobre cookies.
            Não precisam de consentimento.
          </li>
          <li>
            <strong>Analíticos (só com consentimento):</strong> usamos o Google
            Analytics para perceber como o site é usado. Só são ativados{' '}
            <strong>depois de aceitares</strong> no aviso de cookies. Por
            omissão, estão desligados (Consent Mode).
          </li>
          <li>
            <strong>Publicidade (só com consentimento):</strong> usamos o Pixel
            da Meta (Meta Platforms Ireland) e o Pixel do TikTok (TikTok
            Technology Limited, Irlanda) para saber se uma encomenda veio de um
            anúncio nosso no Instagram, Facebook ou TikTok. Estes scripts{' '}
            <strong>nem sequer são carregados</strong> sem a tua autorização.
            Não enviamos o teu nome, email, telemóvel ou morada a estas
            plataformas — apenas eventos (ver a ementa, adicionar ao carrinho,
            iniciar e concluir uma encomenda) e o valor da encomenda. Estas
            empresas podem transferir dados para fora do Espaço Económico
            Europeu, ao abrigo das garantias que elas próprias adotam (por
            exemplo, o Quadro de Privacidade de Dados UE-EUA ou cláusulas
            contratuais-tipo).
          </li>
        </ul>
        <p>
          O mapa da página Contactos é fornecido pelo OpenStreetMap e não instala
          cookies de rastreio.
        </p>
      </Seccao>

      <Seccao titulo="3. Como gerir o teu consentimento">
        <p>
          Na primeira visita mostramos um aviso onde podes <strong>aceitar tudo</strong>,{' '}
          <strong>recusar</strong> ou <strong>personalizar</strong>, escolhendo
          separadamente os cookies de análise e os de publicidade. Nada vem
          pré-selecionado. Podes mudar ou retirar a tua escolha a qualquer
          momento no link <strong>Gerir cookies</strong>, no rodapé de todas as
          páginas. Podes ainda apagar os cookies através das definições do teu
          navegador, o que fará o aviso voltar a aparecer.
        </p>
      </Seccao>

      <Seccao titulo="4. Alterações">
        <p>
          Podemos atualizar esta política de cookies sempre que necessário. A
          data no topo indica a última revisão. Para mais detalhes sobre o
          tratamento de dados, consulta a Política de Privacidade.
        </p>
      </Seccao>
    </PaginaLegal>
  )
}

export default Cookies
