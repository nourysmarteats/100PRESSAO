-- ═══════════════════════════════════════════════════════════════════════════
-- Fichas técnicas dos 23 pratos — VERSÃO CORRIGIDA
--
-- Base: 2026-08-16-fichas-tecnicas-23-pratos.sql (Rita Falcão, Chef Executiva).
-- Correcções estruturais: 2026-08-16.
--
-- ── PORQUE EXISTE ESTA VERSÃO ─────────────────────────────────────────────
-- O original ligava TODOS os pratos por `join products on nome`. Os 15 Pratos
-- Feitos não são produtos — são variantes do produto "Prato Feito". O join não
-- os encontrava e o insert descartava-os EM SILÊNCIO, sem erro nem aviso:
--
--     linhas de ficha no ficheiro ....... 239
--     linhas que entravam mesmo .......... 33   (6 pratos de 23)
--     descartadas sem aviso ............. 206   (86%, incluindo os 15 PF)
--
-- O que muda aqui:
--   1. Os 15 PF passam a ligar por `variant_id` (product_variants).
--      A tabela já o suporta: CHECK num_nonnulls(product_id,variant_id,combo_id)=1.
--   2. Três nomes corrigidos para os da base de dados:
--        'Carne de Porco à Alentejana' -> 'Carne de Porco Alentejana'  (sem crase)
--        'Heineken (imperial)'         -> 'Heineken'
--        'Copo Cheio (IPA da casa)'    -> 'Copo Cheio'
--   3. Pares (prato,ingrediente) repetidos SOMADOS numa linha só. A tabela não
--      tem unicidade em (produto,ingrediente) e o `where not exists` do original
--      só olhava para o que já lá estava, não para as linhas da própria
--      instrução — as repetidas entravam as duas e o gatilho descontava a dobrar.
--   4. A conferência final FALHA EM VOZ ALTA (raise exception + rollback) se
--      algum prato ficar sem ficha, em vez de deixar passar em silêncio.
--
-- ── PENDENTE DE CONFIRMAÇÃO DA RITA — NÃO APLICAR ANTES ───────────────────
-- Três quantidades por dose que parecem erro de unidade. Ficam aqui tal como
-- ela as escreveu (não se inventam doses), mas dominam o food cost:
--
--     Manteiga ....... 0,17 kg = 170 g   em TODOS os 15 PF (base fixa)
--     Coentros ....... 0,10 kg = 100 g   no Peito de Frango Grelhado
--     Cebola ......... 1,10 kg = 1,1 kg  na Carne de Panela      (1,0 + 0,1 somados)
--     Cebola ......... 0,60 kg = 600 g   no Bife Acebolado       (0,5 + 0,1 somados)
--     Cebola ......... 0,60 kg = 600 g   no Frango Ensopado      (0,5 + 0,1 somados)
--
-- Note-se o padrão na cebola: 0,5 / 1,0 kg aparecem como quantidade "do prato"
-- e 0,1 kg como parte da base fixa. A de 0,1 é plausível; as outras parecem
-- ser a quantidade de uma PANELA inteira e não de uma dose — o que faria
-- sentido se a ficha tivesse sido escrita a partir de uma receita de produção.
-- É essa a pergunta a fazer-lhe.
--
-- ── E ANTES DE TUDO: OS PREÇOS ────────────────────────────────────────────
-- A própria Rita avisou no ficheiro das doses que não faz sentido corrigir o
-- stock enquanto os preços estiverem errados. Os 15 PF estão a 8,40 € na base
-- de dados; a grelha dela diz 12,90 €. Com os preços errados, o food cost que
-- as conferências abaixo mostram é ficção.
--
-- Os custos dos itens criados na PARTE 1 são estimativas de cash & carry da
-- Rita — rever em Admin -> Stock com os preços reais antes de confiar neles.
--
-- Idempotente. Reversão no fim do ficheiro.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── PARTE 1) Itens de stock em falta ──────────────────────────────────────
-- Inalterada face ao original. Os 60 ingredientes referidos nas fichas foram
-- todos confirmados contra a base de dados: 42 já existiam, estes 18 faltavam.
insert into public.stock_items (nome, categoria, unidade, custo, quantidade, ativo)
select v.nome, v.categoria, v.unidade, v.custo, 0, true
from (values
  ('Piano de porco (entrecosto)', 'Carnes e Peixe', 'kg', 5.50),
  ('Maminha de vaca', 'Carnes e Peixe', 'kg', 15.50),
  ('Frango inteiro', 'Carnes e Peixe', 'kg', 3.20),
  ('Frango em pedaços (coxa e perna)', 'Carnes e Peixe', 'kg', 3.80),
  ('Carne de vaca para estufar (chã de fora)', 'Carnes e Peixe', 'kg', 9.50),
  ('Bacalhau em lascas demolhado', 'Carnes e Peixe', 'kg', 14.00),
  ('Filete de pescada congelado', 'Carnes e Peixe', 'kg', 6.80),
  ('Perca (filete congelado)', 'Carnes e Peixe', 'kg', 8.50),
  ('Ameijoa congelada', 'Carnes e Peixe', 'kg', 7.50),
  ('Massa cotovelo / macarrão', 'Mercearia', 'kg', 1.20),
  ('Pão ralado', 'Mercearia', 'kg', 1.80),
  ('Carnes de feijoada (orelha, chispe, farinheira)', 'Charcutaria', 'kg', 4.50),
  ('Couve portuguesa', 'Legumes', 'kg', 1.80),
  ('Azeitonas', 'Mercearia', 'kg', 5.00),
  ('Tremoços', 'Mercearia', 'kg', 2.80),
  ('Bolo da Dona Célia (fatia)', 'Semi-prontos', 'unidade', 0.70),
  ('Massa de pimentão', 'Mercearia', 'kg', 6.00),
  ('Orégãos', 'Mercearia', 'kg', 14.00)
) as v(nome, categoria, unidade, custo)
where not exists (select 1 from public.stock_items s where s.nome = v.nome);

-- ── PARTE 2A) Fichas dos 15 Prato Feito — por VARIANTE ────────────────────
-- É aqui que estava a avaria. O gatilho baixar_stock_venda usa a precedência
-- combo > variante > produto, por isso a ficha TEM de estar na variante: uma
-- ficha no produto "Prato Feito" seria ignorada sempre que a venda trouxesse
-- variante, que é sempre.
insert into public.stock_receitas (variant_id, stock_item_id, quantidade)
select pv.id, s.id, v.qtd::numeric
from (values
  ('Bife Acebolado'           , 'Bife de vaca (acém/vazia)'                               , 0.18),
  ('Bife Acebolado'           , 'Cebola'                                                  , 0.6),
  ('Bife Acebolado'           , 'Azeite virgem extra'                                     , 0.025),
  ('Bife Acebolado'           , 'Arroz agulha'                                            , 0.05),
  ('Bife Acebolado'           , 'Feijão preto'                                            , 0.048),
  ('Bife Acebolado'           , 'Farinha de mandioca (farofa)'                            , 0.022),
  ('Bife Acebolado'           , 'Manteiga'                                                , 0.17),
  ('Bife Acebolado'           , 'Alface / mistura de salada'                              , 0.04),
  ('Bife Acebolado'           , 'Tomate fresco'                                           , 0.015),
  ('Bife Acebolado'           , 'Alho fresco'                                             , 0.002),
  ('Bife Acebolado'           , 'Especiarias base (louro, alho em pó, pimenta preta, sal)', 0.001),

  ('Peito de Frango Grelhado' , 'Peito de frango'                                         , 0.2),
  ('Peito de Frango Grelhado' , 'Limão'                                                   , 0.02),
  ('Peito de Frango Grelhado' , 'Coentros'                                                , 0.1),
  ('Peito de Frango Grelhado' , 'Azeite virgem extra'                                     , 0.025),
  ('Peito de Frango Grelhado' , 'Arroz agulha'                                            , 0.05),
  ('Peito de Frango Grelhado' , 'Feijão preto'                                            , 0.048),
  ('Peito de Frango Grelhado' , 'Farinha de mandioca (farofa)'                            , 0.022),
  ('Peito de Frango Grelhado' , 'Manteiga'                                                , 0.17),
  ('Peito de Frango Grelhado' , 'Alface / mistura de salada'                              , 0.04),
  ('Peito de Frango Grelhado' , 'Tomate fresco'                                           , 0.015),
  ('Peito de Frango Grelhado' , 'Cebola'                                                  , 0.1),
  ('Peito de Frango Grelhado' , 'Alho fresco'                                             , 0.002),
  ('Peito de Frango Grelhado' , 'Especiarias base (louro, alho em pó, pimenta preta, sal)', 0.001),

  ('Bacalhau à Brás'          , 'Bacalhau desfiado demolhado congelado'                   , 0.16),
  ('Bacalhau à Brás'          , 'Batata palha'                                            , 0.08),
  ('Bacalhau à Brás'          , 'Ovos'                                                    , 2),
  ('Bacalhau à Brás'          , 'Cebola'                                                  , 0.5),
  ('Bacalhau à Brás'          , 'Azeitonas'                                               , 0.015),
  ('Bacalhau à Brás'          , 'Azeite virgem extra'                                     , 0.016),
  ('Bacalhau à Brás'          , 'Alface / mistura de salada'                              , 0.04),
  ('Bacalhau à Brás'          , 'Tomate fresco'                                           , 0.015),
  ('Bacalhau à Brás'          , 'Especiarias base (louro, alho em pó, pimenta preta, sal)', 0.0005),

  ('Filet de Peixe'           , 'Filete de pescada congelado'                             , 0.2),
  ('Filet de Peixe'           , 'Farinha de trigo'                                        , 0.02),
  ('Filet de Peixe'           , 'Ovos'                                                    , 1),
  ('Filet de Peixe'           , 'Limão'                                                   , 0.015),
  ('Filet de Peixe'           , 'Óleo de fritura (girassol)'                              , 0.015),
  ('Filet de Peixe'           , 'Arroz agulha'                                            , 0.05),
  ('Filet de Peixe'           , 'Feijão preto'                                            , 0.048),
  ('Filet de Peixe'           , 'Farinha de mandioca (farofa)'                            , 0.022),
  ('Filet de Peixe'           , 'Manteiga'                                                , 0.17),
  ('Filet de Peixe'           , 'Alface / mistura de salada'                              , 0.04),
  ('Filet de Peixe'           , 'Tomate fresco'                                           , 0.015),
  ('Filet de Peixe'           , 'Cebola'                                                  , 0.1),
  ('Filet de Peixe'           , 'Alho fresco'                                             , 0.002),
  ('Filet de Peixe'           , 'Azeite virgem extra'                                     , 0.02),
  ('Filet de Peixe'           , 'Especiarias base (louro, alho em pó, pimenta preta, sal)', 0.001),

  ('Peito de Frango Amilanesa', 'Peito de frango'                                         , 0.2),
  ('Peito de Frango Amilanesa', 'Ovos'                                                    , 1),
  ('Peito de Frango Amilanesa', 'Farinha de trigo'                                        , 0.025),
  ('Peito de Frango Amilanesa', 'Pão ralado'                                              , 0.04),
  ('Peito de Frango Amilanesa', 'Óleo de fritura (girassol)'                              , 0.02),
  ('Peito de Frango Amilanesa', 'Limão'                                                   , 0.015),
  ('Peito de Frango Amilanesa', 'Arroz agulha'                                            , 0.05),
  ('Peito de Frango Amilanesa', 'Feijão preto'                                            , 0.048),
  ('Peito de Frango Amilanesa', 'Farinha de mandioca (farofa)'                            , 0.022),
  ('Peito de Frango Amilanesa', 'Manteiga'                                                , 0.17),
  ('Peito de Frango Amilanesa', 'Alface / mistura de salada'                              , 0.04),
  ('Peito de Frango Amilanesa', 'Tomate fresco'                                           , 0.015),
  ('Peito de Frango Amilanesa', 'Cebola'                                                  , 0.1),
  ('Peito de Frango Amilanesa', 'Alho fresco'                                             , 0.002),
  ('Peito de Frango Amilanesa', 'Azeite virgem extra'                                     , 0.02),
  ('Peito de Frango Amilanesa', 'Especiarias base (louro, alho em pó, pimenta preta, sal)', 0.001),

  ('Carne de Porco Alentejana', 'Entremeada de porco'                                     , 0.18),
  ('Carne de Porco Alentejana', 'Ameijoa congelada'                                       , 0.12),
  ('Carne de Porco Alentejana', 'Batata'                                                  , 0.15),
  ('Carne de Porco Alentejana', 'Massa de pimentão'                                       , 0.008),
  ('Carne de Porco Alentejana', 'Vinho branco de cozinha'                                 , 0.04),
  ('Carne de Porco Alentejana', 'Alho fresco'                                             , 0.005),
  ('Carne de Porco Alentejana', 'Coentros'                                                , 0.1),
  ('Carne de Porco Alentejana', 'Óleo de fritura (girassol)'                              , 0.015),
  ('Carne de Porco Alentejana', 'Azeite virgem extra'                                     , 0.013),
  ('Carne de Porco Alentejana', 'Alface / mistura de salada'                              , 0.04),
  ('Carne de Porco Alentejana', 'Tomate fresco'                                           , 0.015),
  ('Carne de Porco Alentejana', 'Especiarias base (louro, alho em pó, pimenta preta, sal)', 0.0005),

  ('Bacalhau a Gomes Sá'      , 'Bacalhau em lascas demolhado'                            , 0.16),
  ('Bacalhau a Gomes Sá'      , 'Batata'                                                  , 0.2),
  ('Bacalhau a Gomes Sá'      , 'Ovos'                                                    , 1),
  ('Bacalhau a Gomes Sá'      , 'Cebola'                                                  , 1),
  ('Bacalhau a Gomes Sá'      , 'Azeitonas'                                               , 0.02),
  ('Bacalhau a Gomes Sá'      , 'Alho fresco'                                             , 0.004),
  ('Bacalhau a Gomes Sá'      , 'Azeite virgem extra'                                     , 0.028),
  ('Bacalhau a Gomes Sá'      , 'Alface / mistura de salada'                              , 0.04),
  ('Bacalhau a Gomes Sá'      , 'Tomate fresco'                                           , 0.015),
  ('Bacalhau a Gomes Sá'      , 'Especiarias base (louro, alho em pó, pimenta preta, sal)', 0.0005),

  ('Frango Assado'            , 'Frango inteiro'                                          , 0.35),
  ('Frango Assado'            , 'Colorau'                                                 , 0.003),
  ('Frango Assado'            , 'Alho fresco'                                             , 0.005),
  ('Frango Assado'            , 'Azeite virgem extra'                                     , 0.028),
  ('Frango Assado'            , 'Arroz agulha'                                            , 0.05),
  ('Frango Assado'            , 'Feijão preto'                                            , 0.048),
  ('Frango Assado'            , 'Farinha de mandioca (farofa)'                            , 0.022),
  ('Frango Assado'            , 'Manteiga'                                                , 0.17),
  ('Frango Assado'            , 'Alface / mistura de salada'                              , 0.04),
  ('Frango Assado'            , 'Tomate fresco'                                           , 0.015),
  ('Frango Assado'            , 'Cebola'                                                  , 0.1),
  ('Frango Assado'            , 'Especiarias base (louro, alho em pó, pimenta preta, sal)', 0.001),

  ('Maminha na Chapa'         , 'Maminha de vaca'                                         , 0.2),
  ('Maminha na Chapa'         , 'Azeite virgem extra'                                     , 0.025),
  ('Maminha na Chapa'         , 'Especiarias base (louro, alho em pó, pimenta preta, sal)', 0.002),
  ('Maminha na Chapa'         , 'Arroz agulha'                                            , 0.05),
  ('Maminha na Chapa'         , 'Feijão preto'                                            , 0.048),
  ('Maminha na Chapa'         , 'Farinha de mandioca (farofa)'                            , 0.022),
  ('Maminha na Chapa'         , 'Manteiga'                                                , 0.17),
  ('Maminha na Chapa'         , 'Alface / mistura de salada'                              , 0.04),
  ('Maminha na Chapa'         , 'Tomate fresco'                                           , 0.015),
  ('Maminha na Chapa'         , 'Cebola'                                                  , 0.1),
  ('Maminha na Chapa'         , 'Alho fresco'                                             , 0.002),

  ('Bacalhau com Natas'       , 'Bacalhau desfiado demolhado congelado'                   , 0.15),
  ('Bacalhau com Natas'       , 'Batata'                                                  , 0.2),
  ('Bacalhau com Natas'       , 'Natas'                                                   , 0.1),
  ('Bacalhau com Natas'       , 'Leite'                                                   , 0.05),
  ('Bacalhau com Natas'       , 'Farinha de trigo'                                        , 0.015),
  ('Bacalhau com Natas'       , 'Manteiga'                                                , 0.2),
  ('Bacalhau com Natas'       , 'Cebola'                                                  , 0.5),
  ('Bacalhau com Natas'       , 'Queijo'                                                  , 1),
  ('Bacalhau com Natas'       , 'Óleo de fritura (girassol)'                              , 0.015),
  ('Bacalhau com Natas'       , 'Alface / mistura de salada'                              , 0.04),
  ('Bacalhau com Natas'       , 'Tomate fresco'                                           , 0.015),
  ('Bacalhau com Natas'       , 'Azeite virgem extra'                                     , 0.008),
  ('Bacalhau com Natas'       , 'Especiarias base (louro, alho em pó, pimenta preta, sal)', 0.0005),

  ('Carne de Panela'          , 'Carne de vaca para estufar (chã de fora)'                , 0.2),
  ('Carne de Panela'          , 'Cebola'                                                  , 1.1),
  ('Carne de Panela'          , 'Tomate pelado'                                           , 0.08),
  ('Carne de Panela'          , 'Vinho branco de cozinha'                                 , 0.04),
  ('Carne de Panela'          , 'Alho fresco'                                             , 0.006),
  ('Carne de Panela'          , 'Azeite virgem extra'                                     , 0.028),
  ('Carne de Panela'          , 'Arroz agulha'                                            , 0.05),
  ('Carne de Panela'          , 'Feijão preto'                                            , 0.048),
  ('Carne de Panela'          , 'Farinha de mandioca (farofa)'                            , 0.022),
  ('Carne de Panela'          , 'Manteiga'                                                , 0.17),
  ('Carne de Panela'          , 'Alface / mistura de salada'                              , 0.04),
  ('Carne de Panela'          , 'Tomate fresco'                                           , 0.015),
  ('Carne de Panela'          , 'Especiarias base (louro, alho em pó, pimenta preta, sal)', 0.001),

  ('Piano'                    , 'Piano de porco (entrecosto)'                             , 0.35),
  ('Piano'                    , 'Colorau'                                                 , 0.004),
  ('Piano'                    , 'Alho fresco'                                             , 0.006),
  ('Piano'                    , 'Azeite virgem extra'                                     , 0.028),
  ('Piano'                    , 'Arroz agulha'                                            , 0.05),
  ('Piano'                    , 'Feijão preto'                                            , 0.048),
  ('Piano'                    , 'Farinha de mandioca (farofa)'                            , 0.022),
  ('Piano'                    , 'Manteiga'                                                , 0.17),
  ('Piano'                    , 'Alface / mistura de salada'                              , 0.04),
  ('Piano'                    , 'Tomate fresco'                                           , 0.015),
  ('Piano'                    , 'Cebola'                                                  , 0.1),
  ('Piano'                    , 'Especiarias base (louro, alho em pó, pimenta preta, sal)', 0.001),

  ('Massada de Perca'         , 'Perca (filete congelado)'                                , 0.18),
  ('Massada de Perca'         , 'Massa cotovelo / macarrão'                               , 0.08),
  ('Massada de Perca'         , 'Tomate pelado'                                           , 0.1),
  ('Massada de Perca'         , 'Cebola'                                                  , 0.5),
  ('Massada de Perca'         , 'Alho fresco'                                             , 0.004),
  ('Massada de Perca'         , 'Coentros'                                                , 0.1),
  ('Massada de Perca'         , 'Azeite virgem extra'                                     , 0.018),
  ('Massada de Perca'         , 'Alface / mistura de salada'                              , 0.04),
  ('Massada de Perca'         , 'Tomate fresco'                                           , 0.015),
  ('Massada de Perca'         , 'Especiarias base (louro, alho em pó, pimenta preta, sal)', 0.0005),

  ('Feijoada da Casa'         , 'Feijão preto'                                            , 0.12),
  ('Feijoada da Casa'         , 'Entremeada de porco'                                     , 0.08),
  ('Feijoada da Casa'         , 'Chouriço de carne'                                       , 0.04),
  ('Feijoada da Casa'         , 'Paio'                                                    , 0.03),
  ('Feijoada da Casa'         , 'Carnes de feijoada (orelha, chispe, farinheira)'         , 0.08),
  ('Feijoada da Casa'         , 'Arroz agulha'                                            , 0.05),
  ('Feijoada da Casa'         , 'Farinha de mandioca (farofa)'                            , 0.022),
  ('Feijoada da Casa'         , 'Manteiga'                                                , 0.17),
  ('Feijoada da Casa'         , 'Couve portuguesa'                                        , 0.06),
  ('Feijoada da Casa'         , 'Laranja'                                                 , 0.25),
  ('Feijoada da Casa'         , 'Cebola'                                                  , 0.05),
  ('Feijoada da Casa'         , 'Alho fresco'                                             , 0.001),
  ('Feijoada da Casa'         , 'Azeite virgem extra'                                     , 0.008),
  ('Feijoada da Casa'         , 'Especiarias base (louro, alho em pó, pimenta preta, sal)', 0.001),

  ('Frango Ensopado'          , 'Frango em pedaços (coxa e perna)'                        , 0.28),
  ('Frango Ensopado'          , 'Pão para Pica-Pau / acompanhamento'                      , 1),
  ('Frango Ensopado'          , 'Cebola'                                                  , 0.6),
  ('Frango Ensopado'          , 'Tomate pelado'                                           , 0.06),
  ('Frango Ensopado'          , 'Alho fresco'                                             , 0.006),
  ('Frango Ensopado'          , 'Coentros'                                                , 0.1),
  ('Frango Ensopado'          , 'Azeite virgem extra'                                     , 0.03),
  ('Frango Ensopado'          , 'Arroz agulha'                                            , 0.05),
  ('Frango Ensopado'          , 'Feijão preto'                                            , 0.048),
  ('Frango Ensopado'          , 'Farinha de mandioca (farofa)'                            , 0.022),
  ('Frango Ensopado'          , 'Manteiga'                                                , 0.17),
  ('Frango Ensopado'          , 'Alface / mistura de salada'                              , 0.04),
  ('Frango Ensopado'          , 'Tomate fresco'                                           , 0.015),
  ('Frango Ensopado'          , 'Especiarias base (louro, alho em pó, pimenta preta, sal)', 0.001)
) as v(variante, ingrediente, qtd)
join public.product_variants pv on pv.nome = v.variante
join public.stock_items       s on s.nome  = v.ingrediente
where not exists (
  select 1 from public.stock_receitas x
  where x.variant_id = pv.id and x.stock_item_id = s.id
);

-- ── PARTE 2B) Fichas dos restantes pratos — por PRODUTO ───────────────────
insert into public.stock_receitas (product_id, stock_item_id, quantidade)
select p.id, s.id, v.qtd::numeric
from (values
  ('Bitoque da Casa'           , 'Bife de vaca (acém/vazia)'         , 0.18),
  ('Bitoque da Casa'           , 'Ovos'                              , 1),
  ('Bitoque da Casa'           , 'Batata'                            , 0.2),
  ('Bitoque da Casa'           , 'Óleo de fritura (girassol)'        , 0.01),
  ('Bitoque da Casa'           , 'Arroz agulha'                      , 0.05),
  ('Bitoque da Casa'           , 'Manteiga'                          , 0.25),
  ('Bitoque da Casa'           , 'Alho fresco'                       , 0.002),
  ('Bitoque da Casa'           , 'Vinho branco de cozinha'           , 0.04),
  ('Bitoque da Casa'           , 'Mostarda'                          , 0.01),
  ('Bitoque da Casa'           , 'Azeite virgem extra'               , 0.005),
  ('Bitoque da Casa'           , 'Guaraná Antarctica 33 cl'          , 1),
  ('Bitoque da Casa'           , 'Café moído'                        , 1),

  ('Pica-Pau'                  , 'Lombo de porco (Pica-Pau)'         , 0.16),
  ('Pica-Pau'                  , 'Alho fresco'                       , 0.008),
  ('Pica-Pau'                  , 'Vinho branco de cozinha'           , 0.05),
  ('Pica-Pau'                  , 'Mostarda'                          , 0.012),
  ('Pica-Pau'                  , 'Pepino de conserva'                , 0.04),
  ('Pica-Pau'                  , 'Manteiga'                          , 0.15),
  ('Pica-Pau'                  , 'Azeite virgem extra'               , 0.008),
  ('Pica-Pau'                  , 'Pão para Pica-Pau / acompanhamento', 1),

  ('Tábua da Casa'             , 'Queijo da Serra (meia cura)'       , 0.06),
  ('Tábua da Casa'             , 'Queijo de Azeitão'                 , 0.06),
  ('Tábua da Casa'             , 'Presunto fatiado'                  , 0.06),
  ('Tábua da Casa'             , 'Chouriço de carne'                 , 0.05),
  ('Tábua da Casa'             , 'Paio'                              , 0.05),
  ('Tábua da Casa'             , 'Marmelada'                         , 0.04),
  ('Tábua da Casa'             , 'Pão para Pica-Pau / acompanhamento', 1),

  ('Azeitonas Temperadas'      , 'Azeitonas'                         , 0.08),
  ('Azeitonas Temperadas'      , 'Alho fresco'                       , 0.002),
  ('Azeitonas Temperadas'      , 'Orégãos'                           , 0.001),
  ('Azeitonas Temperadas'      , 'Azeite virgem extra'               , 0.005),

  ('Tremoços'                  , 'Tremoços'                          , 0.1),

  ('Bolo da Dona Célia (fatia)', 'Bolo da Dona Célia (fatia)'        , 1),

  ('Heineken'                  , 'Barril Heineken 50L'               , 0.2),

  ('Copo Cheio'                , 'Cerveja da casa — IPA (Copo Cheio)', 0.33)
) as v(produto, ingrediente, qtd)
join public.products    p on p.nome = v.produto
join public.stock_items s on s.nome = v.ingrediente
where not exists (
  select 1 from public.stock_receitas x
  where x.product_id = p.id and x.stock_item_id = s.id
);

-- ── PARTE 3) Conferência que FALHA EM VOZ ALTA ────────────────────────────
-- O original limitava-se a listar o que faltava, e quem corresse o script sem
-- ler a saída ficava convencido de que tinha corrido bem. Aqui, se algum dos
-- 23 pratos ficar sem ficha, a transacção inteira é revertida.
do $$
declare
  em_falta text;
begin
  select string_agg(nome, ', ' order by nome) into em_falta
  from (
    select v.nome
    from (values
      ('Bacalhau a Gomes Sá'),
      ('Bacalhau com Natas'),
      ('Bacalhau à Brás'),
      ('Bife Acebolado'),
      ('Carne de Panela'),
      ('Carne de Porco Alentejana'),
      ('Feijoada da Casa'),
      ('Filet de Peixe'),
      ('Frango Assado'),
      ('Frango Ensopado'),
      ('Maminha na Chapa'),
      ('Massada de Perca'),
      ('Peito de Frango Amilanesa'),
      ('Peito de Frango Grelhado'),
      ('Piano')
    ) as v(nome)
    left join public.product_variants pv on pv.nome = v.nome
    where pv.id is null
       or not exists (select 1 from public.stock_receitas r where r.variant_id = pv.id)

    union all

    select v.nome
    from (values
      ('Azeitonas Temperadas'),
      ('Bitoque da Casa'),
      ('Bolo da Dona Célia (fatia)'),
      ('Copo Cheio'),
      ('Heineken'),
      ('Pica-Pau'),
      ('Tremoços'),
      ('Tábua da Casa')
    ) as v(nome)
    left join public.products p on p.nome = v.nome
    where p.id is null
       or not exists (select 1 from public.stock_receitas r where r.product_id = p.id)
  ) q;

  if em_falta is not null then
    raise exception 'Fichas por atribuir (nome não encontrado ou insert ignorado): %', em_falta;
  end if;

  raise notice 'OK: os 23 pratos ficaram com ficha técnica.';
end $$;

-- ── PARTE 4) Food cost resultante ─────────────────────────────────────────
-- Ler com a ressalva do cabeçalho: enquanto os PF estiverem a 8,40 € em vez de
-- 12,90 €, a percentagem sai inflacionada. E a manteiga a 170 g/dose, se se
-- confirmar erro, deita abaixo todos os valores dos PF.
select coalesce(pv.nome, p.nome) as prato,
       case when pv.id is not null then 'variante' else 'produto' end as tipo,
       round(sum(r.quantidade * s.custo), 4) as custo_dose,
       coalesce(pv.preco, p.preco)           as pvp_actual,
       round(sum(r.quantidade * s.custo) / nullif(coalesce(pv.preco, p.preco), 0) * 100, 1) as food_cost_pct,
       count(*) filter (where s.custo is null) as ingredientes_sem_custo
from   public.stock_receitas r
join   public.stock_items    s  on s.id  = r.stock_item_id
left   join public.products  p  on p.id  = r.product_id
left   join public.product_variants pv on pv.id = r.variant_id
group  by coalesce(pv.nome, p.nome), case when pv.id is not null then 'variante' else 'produto' end,
          coalesce(pv.preco, p.preco)
order  by food_cost_pct desc nulls last;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- OPCIONAL — impedir que o problema dos duplicados volte
-- ═══════════════════════════════════════════════════════════════════════════
-- A stock_receitas não tem unicidade em (alvo, ingrediente). Estes índices
-- fecham a porta: a partir daqui, um ingrediente repetido no mesmo prato dá
-- erro em vez de descontar a dobrar. Correr só depois de confirmar que não há
-- duplicados por limpar (senão a criação falha, que é o que se quer saber).
--
-- create unique index if not exists stock_receitas_produto_item_uniq
--   on public.stock_receitas (product_id, stock_item_id) where product_id is not null;
-- create unique index if not exists stock_receitas_variante_item_uniq
--   on public.stock_receitas (variant_id, stock_item_id) where variant_id is not null;
-- create unique index if not exists stock_receitas_combo_item_uniq
--   on public.stock_receitas (combo_id, stock_item_id) where combo_id is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- REVERSÃO — apaga as fichas destes 23 pratos e os 18 itens criados
-- ═══════════════════════════════════════════════════════════════════════════
--
-- begin;
-- delete from public.stock_receitas r
-- using public.product_variants pv
-- where r.variant_id = pv.id and pv.nome in (
--   'Bacalhau a Gomes Sá',
--   'Bacalhau com Natas',
--   'Bacalhau à Brás',
--   'Bife Acebolado',
--   'Carne de Panela',
--   'Carne de Porco Alentejana',
--   'Feijoada da Casa',
--   'Filet de Peixe',
--   'Frango Assado',
--   'Frango Ensopado',
--   'Maminha na Chapa',
--   'Massada de Perca',
--   'Peito de Frango Amilanesa',
--   'Peito de Frango Grelhado',
--   'Piano'
-- );
-- delete from public.stock_receitas r
-- using public.products p
-- where r.product_id = p.id and p.nome in (
--   'Azeitonas Temperadas',
--   'Bitoque da Casa',
--   'Bolo da Dona Célia (fatia)',
--   'Copo Cheio',
--   'Heineken',
--   'Pica-Pau',
--   'Tremoços',
--   'Tábua da Casa'
-- );
-- delete from public.stock_items where nome in (
--   'Piano de porco (entrecosto)',
--   'Maminha de vaca',
--   'Frango inteiro',
--   'Frango em pedaços (coxa e perna)',
--   'Carne de vaca para estufar (chã de fora)',
--   'Bacalhau em lascas demolhado',
--   'Filete de pescada congelado',
--   'Perca (filete congelado)',
--   'Ameijoa congelada',
--   'Massa cotovelo / macarrão',
--   'Pão ralado',
--   'Carnes de feijoada (orelha, chispe, farinheira)',
--   'Couve portuguesa',
--   'Azeitonas',
--   'Tremoços',
--   'Bolo da Dona Célia (fatia)',
--   'Massa de pimentão',
--   'Orégãos'
-- );
-- commit;
