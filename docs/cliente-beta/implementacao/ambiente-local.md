# Ambiente local de testes

Preparado em 14 de setembro de 2026, com autorização do Leandro para substituir o branch pago por um ambiente local isolado.

- Homebrew, Colima e Docker CLI instalados.
- Perfil Colima: `100pressao`, 2 CPUs, 4 GiB de RAM, disco de dados até 30 GiB.
- Sem arranque automático e sem partilha das pastas pessoais com a máquina virtual.
- Pasta: `/Users/miranda/.local/share/100pressao-testes`.
- Supabase local: projeto `100pressao-testes`, Postgres 17. Sem ligação ao projeto remoto.
- Só dados fictícios. O esquema do negócio ainda precisa de ser preparado e validado antes dos testes funcionais.

## Iniciar

```sh
PATH=/opt/homebrew/bin:$PATH colima start 100pressao
PATH=/opt/homebrew/bin:$PATH DOCKER_HOST=unix:///Users/miranda/.colima/100pressao/docker.sock npx --yes supabase start --workdir /Users/miranda/.local/share/100pressao-testes --network-id 100pressao-testes-local --exclude realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor
```

Os serviços excluídos não são necessários para esta primeira preparação da base, autenticação e API. Testes dessas áreas exigem ativar os serviços correspondentes.

A rede `100pressao-testes-local` foi criada com `com.docker.network.bridge.host_binding_ipv4=127.0.0.1`, conforme a [documentação Docker](https://docs.docker.com/engine/network/port-publishing/). Preservar a opção `--network-id` ao iniciar: sem ela o comportamento predefinido pode publicar portas na rede local.

## Parar, preservando os dados locais

```sh
PATH=/opt/homebrew/bin:$PATH DOCKER_HOST=unix:///Users/miranda/.colima/100pressao/docker.sock npx --yes supabase stop --workdir /Users/miranda/.local/share/100pressao-testes
PATH=/opt/homebrew/bin:$PATH colima stop 100pressao
```

Não usar opções de eliminação de volumes para parar o ambiente. Não copiar chaves ou dados pessoais de produção para aqui.

## Verificação

Instalação das ferramentas e arranque do Colima confirmados. A base local respondeu como Postgres 17.6. Teste SQL confirmado: criação de tabela temporária, inserção de valor fictício, leitura e rollback, sem persistência do registo.

Serviços de base, autenticação, painel, metadados, correio de teste e gateway saudáveis. API respondeu HTTP 200; painel respondeu HTTP 200 após redirecionamento. Reinício preservando os volumes confirmado. Portas publicadas verificadas em `127.0.0.1`, sem escuta nas interfaces da rede local.

Painel disponível apenas neste Mac: <http://127.0.0.1:54323>.

Esta verificação confirma a instalação. Não valida ainda o programa Cliente Beta nem significa que as alterações da aplicação foram publicadas.
