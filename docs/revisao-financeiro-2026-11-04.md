# Revisão do financeiro - 04/11/2026

Revisão do código de importação, parsers, conferência, conciliação, fechamento, análise, propostas e contas a pagar. Inclui correções e testes locais. Não houve acesso ao banco de produção nem validação autenticada com Drive: este checkout não contém `.env.local`. Portanto, os achados abaixo descrevem caminhos comprováveis no código, não divergências comprovadas nos dados reais. Nenhuma migration foi criada.

## Corrigido nesta revisão

| Problema | Correção | Evidência automatizada |
| --- | --- | --- |
| PDF dependia de colunas separadas por tabulação/espaços largos e perdia a origem da página | Leitura por página, fallback para extratos com espaços simples, valor com C/D, separação do saldo, página e linha de origem | `src/lib/financeiro/parse-pdf.test.ts`: PDFs reais gerados com PDFKit |
| Página digitalizada passava despercebida se outra página fosse legível | Pendência por página sem texto ou sem layout reconhecido; extração limitada a 100 páginas com aviso explícito | PDF misto nos testes |
| Valores corrompidos podiam virar números plausíveis ou desaparecer sem aviso | Validação estrita de valor/data; erros em CSV, OFX e taxas das plataformas geram aviso | `values.test.ts`, `parse-document.test.ts` |
| Tipo saída de CSV genérico podia ser importado como entrada | Débito/crédito reconhecidos independentemente do banco | CSV com valor positivo e tipo saída |
| Rendimentos de CDB eram classificados como aplicação | Regra de rendimento antes da identificação do produto de investimento | `automation.test.ts` |
| Transações iguais em abas/páginas diferentes podiam colidir no hash | Identidade da aba/página incluída no hash | XLSX com duas contas nos testes |
| Conferir uma receita faturada criava entrada de caixa e podia perder taxas | Faturamento sem fluxo de caixa, composição preservada e direção explícita para ajustes/estornos | `review.test.ts`, teste da API de conferência |
| Omitir o ID de lançamento na conferência permitia criar outra linha | Exige corrigir o lançamento vinculado à pendência | Teste da API |
| Conferência alterava lançamentos conciliados ou meses fechados | Bloqueio do mês da importação, data original e nova data; bloqueio de conciliados | Testes da API; garantia ainda depende de transação no banco para concorrência |
| Falhas ao gravar pendências/histórico/status podiam parecer sucesso | Resposta de falha, manifesto marcado FAILED quando possível e pendências gravadas antes do estado final | Testes da API de importação |
| Falha ao consultar o fechamento permitia continuar o upload | Interrupção antes de enviar ao Drive | Teste da API de importação |
| Resumo podia retornar listas vazias quando consultas falhavam | Verificação dos erros das três consultas | Typecheck e revisão de código |
| Arquivos RECEIVED podiam passar na checagem de fechamento | Só aceita documentos PROCESSED/PARTIAL e sem exceções abertas | Revisão de código |
| Formulários tinham erros pouco claros e permitiam reenvio durante processamento | Bloqueio durante envio, mensagens de duplicidade e limites de PDF/OCR explícitos | Lint e TypeScript |

## Pendências prioritárias

### P0 - Substituição destrutiva no financeiro legado

`src/app/(dashboard)/financeiro/actions.ts`, função `importarFinanceiroInner`, apaga todos os `financial_entries` antes de inserir a nova planilha. Se o insert falhar, o conjunto anterior já foi removido. A sincronização de propostas em `propostas/actions.ts` também remove linhas de origem planilha antes de reconstruí-las.

Recomendação: área de preparação, comparação por chave de origem e substituição em transação, com prévia do que será alterado e recuperação. Não executar esse fluxo para validar em produção sem cópia dos dados.

### P1 - Transações e fechamento no banco

Importação, conferência, conciliação e fechamento usam múltiplas requisições. A checagem de mês fechado na API não impede outra requisição de fechar o mês entre a leitura e a escrita. A migration `20261029182330_finance_monthly_close.sql` cria o manifesto do mês e RLS, mas não instala bloqueio de escrita no livro para períodos fechados.

Recomendação: funções transacionais com controle de acesso e bloqueios por competência para operações do livro, conferência, conciliação e fechamento. Gravar a auditoria na mesma transação. As verificações adicionadas nesta revisão reduzem falhas sequenciais, mas não resolvem concorrência nem revertem todas as gravações parciais.

### P1 - Duplicidade entre documentos e reprocessamento

O SHA-256 impede repetir o mesmo arquivo. `unique(import_id, line_hash)` protege somente dentro de uma importação. O mesmo movimento em PDF e CSV, extratos sobrepostos ou outra versão do arquivo ainda pode entrar duas vezes. `external_transaction_id` tem índice, sem unicidade por conta/provedor. Um manifesto FAILED também é tratado como duplicata ao reenviar o arquivo.

Recomendação: identificar conta/provedor/moeda, comparar IDs externos e candidatos por data/valor/descrição; mostrar os candidatos e oferecer mesclagem antes de gravar. Adicionar reprocessamento explícito do manifesto existente, sem duplicar livro ou documento no Drive. Não mesclar automaticamente apenas por valor/data: pagamentos legítimos podem ser iguais.

### P1 - Totais incompletos e conceitos misturados

`analise/page.tsx` carrega os últimos 2.000 registros antes de filtrar a competência no cliente. O limite efetivo do projeto Supabase também pode ser menor. Meses antigos podem desaparecer e totais podem ser parciais sem aviso confiável. A página soma entradas/saídas de aplicações e resgates nos cards chamados Receitas/Despesas. A view de recebíveis considera PARCIALMENTE_CONCILIADO como o líquido inteiro recebido.

Recomendação: agregação no banco para todos os registros da competência, paginação somente da tabela e indicadores separados para caixa, resultado operacional, faturamento, investimentos e recebíveis. Recebido deve vir dos valores efetivamente conciliados.

### P1 - Propostas, parcelas e caixa não formam um fluxo único

`atualizarProposta` altera valor/prazo/status da proposta sem recalcular ou validar as parcelas existentes. Criação e baixa de proposta/parcelas são gravações separadas. As baixas de `proposta_parcelas` e `pagamentos_ectolab` não criam automaticamente eventos no `finance_ledger` nesses handlers. O livro legado e o automatizado também coexistem.

Recomendação: escolher o livro como fonte de caixa, definir competência e vencimento separadamente, ligar baixas e parcelas ao movimento e recalcular somente parcelas abertas mediante confirmação. Preservar baixas já realizadas e histórico de alterações.

### P1 - OCR e documentos fiscais

Agora são lidos PDFs textuais de extratos com cabeçalhos e colunas reconhecíveis. PDFs digitalizados, imagens, comprovantes e notas fiscais sem esse layout ficam arquivados para conferência; não há OCR nesta entrega. PDFs com senha exigem cópia desbloqueada. Datas sem ano, lançamentos quebrados em várias linhas e tabelas sem cabeçalho por página podem exigir revisão. O fallback exige cabeçalho e nunca converte o total de uma nota em pagamento automaticamente.

Próxima etapa: OCR com rastreio de página e campo, esquema validado, prévia de extração, busca de duplicatas e confirmação humana antes de efetivar. Distinguir nota emitida, vencimento, comprovante e liquidação para evitar duplicar a mesma operação.

### P2 - Plataformas, moedas e conciliação

Conciliação cobre somente par único, líquido igual e distância de até sete dias. Não há cobertura completa de vários pagamentos para um depósito, parcelamentos e liquidações parciais. CSVs Stripe podem trazer moedas diferentes, mas o parser não converte nem bloqueia moeda estrangeira; o livro tem BRL como padrão. Estorno parcial de venda ainda exige revisão do modelo para manter faturamento e recebíveis corretos. `calculateNet` limita negativos a zero, o que pode esconder divergência se custos excederem o bruto.

Recomendação: impedir mistura de moedas, validar bruto/taxas/líquido, modelar estornos como eventos vinculados e conciliar pelos valores alocados em cada vínculo. Tornar as regras persistidas em `finance_rules` efetivamente configuráveis e utilizadas no processamento.

### P2 - Operação, volume e recuperação

Upload múltiplo processa todos os arquivos numa requisição de até 60 segundos, com limite de 10 MB por arquivo, sem limite agregado. O host pode ter teto de requisição menor. Upload ao Drive precede o manifesto, podendo deixar arquivo órfão se a gravação no banco falhar. Criação de entidades ignora alguns erros e repete consultas para categorias/provedores já vistos. Conferência tem limite de 200 exceções; precisam existir paginação e indicação do total. Uma exceção de página sem extração permite criar apenas um lançamento antes de encerrar: não substitui uma tela de digitação de extrato inteiro.

Recomendação: upload direto ou por arquivo, fila com progresso e repetição idempotente, manifesto antes de processar, recuperação/limpeza de órfãos, cache por importação de entidades, paginação e conferência de múltiplas linhas do mesmo documento.

## Validação e limites

- Testes de parsers, valores, classificação, conferência e falhas de persistência com banco/Drive simulados.
- PDFs gerados nos testes são processados pela biblioteca real, incluindo páginas mistas, valores C/D e documento inválido.
- TypeScript, ESLint nos arquivos envolvidos e build Next.js de produção.
- Não foi possível confirmar RLS efetiva, migrations aplicadas, duplicatas existentes, saldos reais ou permissões do Drive sem credenciais de ambiente. A revisão não certifica os dados em produção.

Sequência recomendada: proteger substituições legadas e operações transacionais; corrigir agregações e unificar baixas; acrescentar detecção/mesclagem entre documentos e reprocessamento; depois OCR e conciliação agregada.
