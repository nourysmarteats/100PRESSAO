import { PaginaLegal, Seccao } from './PaginaLegal'

const SEO = {
  title: 'Termos de Uso | 100PRESSÃO',
  description:
    'Condições de utilização do site e da ementa digital do 100PRESSÃO Draft House.',
}

function Termos() {
  return (
    <PaginaLegal titulo="Termos de Uso" atualizado="18/07/2026" seo={SEO}>
      <p className="leading-relaxed text-grafite-600">
        Ao usar este site, concordas com estas condições. Se não concordares,
        pedimos que não o utilizes.
      </p>

      <Seccao titulo="1. O que este site faz">
        <p>
          Este site apresenta o 100PRESSÃO Draft House, a sua ementa e
          informações de contacto, e permite fazer pedidos à mesa através da
          ementa digital. É operado pela Sintonia dos Temperos.
        </p>
      </Seccao>

      <Seccao titulo="2. Pedidos e pagamentos">
        <p>
          Os pedidos feitos pela ementa digital são enviados à nossa equipa para
          preparação. O <strong>pagamento é feito no local</strong>; o site
          apenas regista o método que preferes, não processa pagamentos nem
          guarda dados de cartão. Podemos não conseguir satisfazer um pedido
          (por exemplo, item esgotado) e, nesse caso, avisamos-te.
        </p>
      </Seccao>

      <Seccao titulo="3. Informação da ementa e alergénios">
        <p>
          Os preços, disponibilidade e descrições podem mudar sem aviso prévio. A
          informação sobre ingredientes e alergénios é dada de boa-fé mas pode
          não ser exaustiva. Se tiveres uma alergia ou intolerância,{' '}
          <strong>confirma sempre com a nossa equipa</strong> antes de consumir.
        </p>
      </Seccao>

      <Seccao titulo="4. Bebidas alcoólicas">
        <p>
          A venda e o consumo de bebidas alcoólicas destinam-se a maiores de
          idade, nos termos da lei. Podemos recusar o serviço quando tal não se
          verifique.
        </p>
      </Seccao>

      <Seccao titulo="5. Propriedade intelectual">
        <p>
          A marca 100PRESSÃO, o logótipo, os textos e os restantes conteúdos do
          site são propriedade da Sintonia dos Temperos ou usados com
          autorização, e não podem ser reutilizados sem consentimento.
        </p>
      </Seccao>

      <Seccao titulo="6. Uso aceitável">
        <p>
          Comprometes-te a usar o site de forma legal e a não tentar interferir
          com o seu funcionamento, segurança ou disponibilidade.
        </p>
      </Seccao>

      <Seccao titulo="7. Limitação de responsabilidade">
        <p>
          Esforçamo-nos por manter o site disponível e a informação correta, mas
          não garantimos que esteja sempre livre de erros ou interrupções. Na
          medida permitida por lei, não somos responsáveis por danos resultantes
          do uso do site.
        </p>
      </Seccao>

      <Seccao titulo="8. Ligações externas">
        <p>
          O site pode conter ligações para outros serviços (por exemplo, redes
          sociais ou mapas). Não somos responsáveis pelos conteúdos ou práticas
          desses serviços.
        </p>
      </Seccao>

      <Seccao titulo="9. Lei aplicável">
        <p>
          Estes termos regem-se pela lei portuguesa. Para qualquer litígio são
          competentes os tribunais portugueses, sem prejuízo dos teus direitos
          enquanto consumidor.
        </p>
      </Seccao>

      <Seccao titulo="10. Contacto">
        <p>
          Para qualquer questão sobre estes termos, escreve para{' '}
          <a href="mailto:geral@100pressao.pt" className="text-cobre-600 underline-offset-4 hover:underline">
            geral@100pressao.pt
          </a>.
        </p>
      </Seccao>
    </PaginaLegal>
  )
}

export default Termos
