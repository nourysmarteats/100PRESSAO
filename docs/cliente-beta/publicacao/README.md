# Cliente Beta — textos preparados para publicação

Preparado em 14 de setembro de 2026. **Não publicado por esta revisão.** Revisão jurídica interna com apoio de IA e da skill Brandão & Associados; não é parecer assinado por advogado humano. O utilizador autorizou implementação e publicação após esta revisão interna.

- `regulamento.md`: condições do programa, aceitação versionada, benefícios e obrigação assumida pela promotora em toda a rede.
- `aviso.md`: apenas inscrição/adesão pré-inauguração; não anuncia SMS, QR ou histórico de pagamentos existente.

A morada foi confirmada pelo utilizador: Praceta Eugénio de Castro, Loja 6 e 7, 2790-063 Carnaxide. A data da inauguração pode permanecer a anunciar até confirmação; tem de ser aplicada no servidor antes do fecho. O enquadramento atual distingue abertura em beta de inauguração.

## Revisão da modelagem técnica proposta

O registo independente de adesão resolve a incompatibilidade entre expurgar dados da campanha e manter benefícios: deve conservar os dados estritamente necessários ao contrato, sem depender de marketing. A revisão anual de necessidade não pode funcionar como caducidade por falta de consumo nem simplesmente apagar o titular porque chegou uma data técnica. Revalidar a necessidade enquanto contrato ativo, com auditoria e controlo de falhas; efetuar expurgo após saída ou fim da finalidade. Renovação técnica automática de prazo não substitui avaliação documentada.

A aceitação dos antigos inscritos deve ser efetuada pelo próprio, depois de ver o texto, através de segredo individual entregue após verificação proporcional pela administração. A emissão do segredo não é aceitação. Não revelar a existência ou dados de inscrição através de consultas públicas por telefone. Guardar versão e instante no servidor. Impedir reutilização, limitar tentativas, expirar e revogar segredos; não os gravar em logs nem URLs de analítica. Não aceitar token que apenas codifica o telefone.

A ausência de prova do telefone no novo formulário não transforma inscrição em prova de identidade. Prever resolução de apropriação/duplicação sem excluir definitivamente o verdadeiro titular e sem expor dados do primeiro inscrito. A validação do consumo pode ser preparada antes da inauguração, mas o contrato assumido exige que um meio utilizável exista quando os benefícios começarem.

## Condições de correspondência antes do deploy

- Origem declarada facultativa na interface E servidor.
- Leitura do aviso, aceitação contratual e marketing separados; os últimos dois nunca presumidos para os antigos inscritos.
- Dados campanha separados da adesão; respeitar expurgo histórico para não aderentes.
- Prazo de saída: identificação/contacto do programa apagados até 30 dias. Prova restrita por três anos, sem nome/telefone e sem alegar anonimização quando ainda houver ligação possível. Retenção baseada em reclamação concreta é exceção documentada, não prolongamento global.
- Registos de limitação por hash IP apagados até24h. Confirmar o processamento efetivo da infraestrutura; não declarar IP inexistente nos logs de fornecedores.
- Hashes/segredos de adesão usados ou expirados inutilizados. Prazo de expiração comunicado junto da entrega.
- Na campanha nova, dados exclusivos de campanha eliminados até30d após inauguração; revisão ao fim12m se ainda sem inauguração. Benefício independe da conservação desses dados.
- Não apresentar o aviso ou ativar a versão na configuração antes de implementar o comportamento descrito. Não modificar o texto histórico arquivado.

## Conservação: justificação interna

A elegibilidade contratual explica a manutenção de nome/contacto durante adesão; não justifica conservar origem da campanha ou histórico detalhado do consumo. Três anos de prova mínima após saída foram mantidos como opção operacional proporcional para gestão de reclamações, com acesso administrativo restrito e eliminação programada. Não é cobertura universal de prescrição. A exceção para litígio concreto permite preservar elementos estritamente necessários por mais tempo. O resultado de avaliação de interesse legítimo deve confirmar que este conjunto mínimo é necessário e que o registo não volta a criar os dados apagados.

## Fontes verificadas

Bases contratuais, informação e conservação: [RGPD](https://eur-lex.europa.eu/legal-content/PT/TXT/?uri=CELEX:32016R0679). Comunicação prévia e limites de alteração: [DL446/85](https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1985-34436475). Marketing eletrónico: [Lei41/2004, art.13.º-A](https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2004-106523049). RAL: [Lei144/2015](https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2015-119475005), [competência CACCL](https://www.centroarbitragemlisboa.pt/recorrer.php).

Fornecedores conhecidos no código: Supabase e Vercel. Foram consultados os acordos oficiais [Supabase](https://supabase.com/legal/dpa) e [Vercel](https://vercel.com/legal/dpa), que contemplam tratamento por subcontratantes e mecanismos de transferência. Não foi verificada a aceitação de contratos da conta nem cada registo técnico de produção; o responsável deve manter evidência dos acordos efetivamente aplicáveis. Não foi afirmado alojamento de todos os tratamentos exclusivamente na UE.

Não subsiste pergunta comercial indispensável para este escopo: regra não acumulável/mais vantajosa concretiza a proposta anterior à autorização «Avance», e a obrigação da promotora concretiza a orientação de rede sem fingir que terceiros já aderiram. Não é necessário inventar um prazo final para os benefícios.
