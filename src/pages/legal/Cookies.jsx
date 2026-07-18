import { PaginaLegal, Seccao } from './PaginaLegal'

const SEO = {
  title: 'Política de Cookies | 100PRESSÃO',
  description:
    'Que cookies e tecnologias semelhantes o site do 100PRESSÃO usa e como gerir o teu consentimento.',
}

function Cookies() {
  return (
    <PaginaLegal titulo="Política de Cookies" atualizado="18/07/2026" seo={SEO}>
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
        </ul>
        <p>
          O mapa da página Contactos é fornecido pelo OpenStreetMap e não instala
          cookies de rastreio.
        </p>
      </Seccao>

      <Seccao titulo="3. Como gerir o teu consentimento">
        <p>
          Na primeira visita mostramos um aviso onde podes <strong>aceitar</strong> ou{' '}
          <strong>recusar</strong> os cookies analíticos. Se recusares, não
          ativamos o Google Analytics. Podes ainda apagar os cookies e limpar a
          tua escolha através das definições do teu navegador, o que fará o aviso
          voltar a aparecer.
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
