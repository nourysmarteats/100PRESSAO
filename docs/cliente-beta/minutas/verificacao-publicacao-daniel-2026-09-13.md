# Cliente Beta — verificação técnica e publicação

13 de setembro de 2026. Análise com a skill Daniel Cunha. Inspeção de leitura; não foram criados commits, enviados pushes ou publicados deployments. A autorização do utilizador para publicar existe; as verificações abaixo distinguem essa autorização da prontidão técnica e do acesso disponível.

## Caminho encontrado

- `.vercel/project.json`: projeto `100pressao`, `prj_Q9rB3rJ8Axny3Z7Ld073XNA4SPPs`, organização `team_TImboRqFcYpx41HDhc0uow9C`.
- Git: `origin` aponta para `git@github.com:nourysmarteats/100PRESSAO.git`; checkout `main` acompanha `origin/main`. HEAD observado: `fb1d4c9`.
- Não foi encontrada pasta `.github` com workflow de publicação. A integração automática GitHub–Vercel e a branch de produção não foram confirmadas remotamente.
- `vercel.json` usa `cleanUrls`, reescrita para `index.html` e cabeçalhos SEO. Novas páginas têm de entrar nas duas listas de pré-renderização do projeto.
- `package.json`: testes de regras puras por `npm test`, build por `npm run build`; projeto React/Vite.

## Acesso remoto: bloqueio comprovado

O conector Vercel devolveu lista de equipas vazia. A consulta direta do projeto/organização indicados no ficheiro local devolveu `403 Forbidden`. Listar projetos dessa organização também falhou. Os executáveis `vercel` e `gh` não estão no PATH deste ambiente.

Isto comprova falta de acesso ao projeto pelo conector atual; não comprova que o projeto deixou de existir nem que todas as credenciais possíveis falhariam. A ligação local identifica um destino, mas não permite declarar publicação viável ou concluída. Não foram inspecionados nem expostos valores de credenciais.

Para publicar pelo caminho comprovável, ligar o conector à conta/equipa com acesso a este projeto; alternativamente, usar um ambiente CLI autorizado para essa conta. Um push Git pode ser alternativa apenas depois de confirmar acesso ao repositório e a integração/branch que publica em produção. Não instalar ferramentas nem criar novo projeto Vercel para contornar esta verificação.

## Implementação mínima para lançar a campanha

A equipa principal inspecionou o esquema real em produção: `beta_testers` não regista unidade nem adesão ao novo programa; a RPC atual verifica `aberto` mas não o instante de inauguração. Não foram identificadas tabelas de unidades/clientes pelos nomes pesquisados. Estes factos são base do desenho, não estimativa de memória.

O mínimo para anunciar os benefícios com inscrição válida é:

1. Regulamento e aviso final publicados com a mesma versão que o servidor carimba; nenhuma aceitação pré-marcada nem derivada da opção publicitária.
2. Campanha associada a uma unidade e a um instante de fecho, ainda anulável enquanto a inauguração não tiver data. Rejeitar inscrição no servidor a partir desse instante, mesmo com `aberto=true`. A interface tem de refletir a mesma regra.
3. Adesão própria ao programa, independente do consentimento de marketing e do expurgo da campanha. Minimizar dados conservados, definir finalidade/prazo, expurgo e auditoria. A elegibilidade de inscritos antigos deve preservar a data original, sem fabricar aceitação.
4. Validar limites, permissões e carimbos no servidor. RLS de dados pessoais para admin, sem tornar telefone pesquisável publicamente nem permitir apropriação de inscrição apenas por o conhecer.
5. Publicar frontend e configuração de versões de forma coordenada com uma migração aditiva, previamente verificada fora de produção. Um preview Vercel continua a apontar para produção se usar as mesmas variáveis: não é ambiente de ensaio da base de dados.

Não é necessário concluir já SMS, cartão dinâmico e motor de descontos para recolher adesão pré-inauguração, desde que os textos não afirmem que essas funcionalidades já existem. Têm de estar implementados e testados antes do início dos benefícios. A mera publicação das minutas não resolve a conservação nem a adesão.

## Opções e custos

| Opção | Vantagem | Limite/custo |
|---|---|---|
| Manter apenas a campanha atual, sem anunciar benefícios novos | Não exige novo mecanismo contratual já | Não cumpre o pedido de lançar o programa de benefícios; continua necessária correção do fecho |
| Implementar agora adesão, unidade, fecho e conservação; ativação do benefício antes da inauguração | Menor âmbito que permite recolher adesão real ao programa | Desenvolvimento e testes necessários; custo não quantificado sem desenho final e ambiente de ensaio |
| Implementar já conta confirmada, cartão temporário e desconto atómico | Permite testar o ciclo inteiro antecipadamente | Maior âmbito; custos de SMS/autenticação e condições do fornecedor por confirmar |

Recomendação técnica: segunda opção. Aproveita a infraestrutura existente, sem pressupor que serviços ou branches adicionais são gratuitos. Nenhum recurso pago foi criado. Para a equipa, a adesão deve continuar simples; offline, não se pode garantir inscrição concluída nem elegibilidade em tempo real, devendo haver mensagem clara e nova tentativa sem duplicação. Novos intermediários de mensagens/autenticação requerem verificação do tratamento de dados antes de os integrar.

## Critérios antes de publicação

- Testes de limites de data e chamada direta à RPC; nova unidade não reabre campanha encerrada.
- Recusar publicidade não impede adesão; expurgo antigo não elimina adesão válida nem fica suspenso globalmente.
- Testes destrutivos, concorrência e expurgo só num branch temporário cuja criação/custo tenham sido avaliados, nunca na base única de produção.
- Build completo com todos os imports rastreados e revisão de artefacto/rotas.
- Isolar alterações deste programa: `Financeiro.jsx`, `relatorios.js` e testes de relatórios encontrados no checkout pertencem a trabalho paralelo e não devem entrar no commit/publicação deste âmbito.
- Confirmar destino Vercel e deployment READY; depois testar páginas públicas e consultar erros sem criar inscrições fictícias em produção.

## Conclusão

Há caminho de implementação concreto, mas publicação ainda não foi executada. Falta acesso comprovado ao projeto Vercel pelo mecanismo disponível; a revisão legal e os requisitos de adesão/conservação precisam de estar satisfeitos no artefacto a publicar. A correção isolada do fecho não equivale à entrada em funcionamento do novo estatuto.

## Verificação complementar: alternativa GitHub

Após a verificação inicial, `git ls-remote origin HEAD refs/heads/main` teve sucesso com rede autorizada. Ambos apontavam para `fb1d4c931f8bc65e09b92640f7d1ee1793f2444a`, igual ao HEAD local observado. Isto confirma acesso de leitura SSH, não constitui teste de escrita.

O conector GitHub confirmou para esse commit um estado `Vercel: success`, associado a [deployment do projeto 100pressao](https://vercel.com/noury-s-projects/100pressao/Dav6f2UrQZowRtuFBJA2twXFxLsy). Não retornou execuções GitHub Actions. Existe, portanto, evidência de integração Vercel para o commit atual de `main`, embora esta consulta não confirme o domínio de produção nem permita gerir o deployment pelo conector Vercel atual. Publicação por push isolado é uma alternativa a verificar, não foi executada nesta revisão.

## Revisão complementar do frontend

Revistos `src/lib/beta.js`, `src/lib/beta.test.mjs` e `src/pages/Beta.jsx`. A submissão verifica novamente o relógio e a pré-visualização não permite enviar inscrições fechadas. O relógio local é apenas apresentação; a RPC é a autoridade. A configuração lida uma só vez pode ficar desatualizada se a data mudar com a página aberta; isso não deve contornar a recusa no servidor.

Corrigido um caso de entrada de relógio finita mas fora do intervalo suportado por `Date`, que antes podia causar exceção ao formatar a data em Lisboa. Acrescentados casos de relógio fora do intervalo e objeto Date inválido. Executados os 16 testes de beta, todos passaram. Não alterada a página nem ficheiros financeiros.
