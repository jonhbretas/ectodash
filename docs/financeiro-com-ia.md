# Financeiro com IA

Entrada: **Financeiro → Financeiro com IA**, em `/financeiro/ia`.

## Uso

1. Selecione a competência e envie os arquivos do mês. São aceitos PDF, XML de notas, JPG, PNG, WebP, CSV, XLSX e OFX, até 3 MB por arquivo. O navegador envia um arquivo por requisição para respeitar os limites de hospedagem. Originais continuam no Drive.
2. A leitura multimodal interpreta PDFs e imagens, inclusive digitalizações legíveis. Planilhas e OFX usam o parser determinístico completo, com IA para classificações incertas. XML é tratado como conteúdo de documento fiscal, sem execução de entidades ou links.
3. Notas, comprovantes e faturas são documentos de suporte: seus totais não viram novos movimentos de caixa. A conferência de notas mostra emitente, número, data, total e um pagamento compatível somente quando valor, data e identidade do emitente apontam um candidato único. Campos ilegíveis podem ser corrigidos na tela após conferir o original.
4. A conciliação automática efetiva apenas pares únicos de venda e crédito com líquido idêntico, até sete dias de distância e evidência da plataforma. Candidatos ambíguos, classificações incertas e divergências ficam pendentes. A busca considera a fronteira entre meses e a previsão de recebimento.
5. O relatório salvo contém os números calculados pelo sistema, análise textual pela IA, cobertura mensal do ano vigente, pendências e recomendações. A IA não fornece os totais que são persistidos no livro.
6. Para fechar, resolva os bloqueios e confirme que todos os documentos aplicáveis foram enviados. O banco revalida o estado dos arquivos, exceções e recebimentos vencidos, confere a versão do relatório e registra fechamento e auditoria em uma transação. Períodos fechados bloqueiam alterações no livro, documentos, pendências e vínculos de conciliação.

## Arquivos anteriores e duplicatas

- **Reler arquivos arquivados com IA** recupera o original pelo ID já registrado no Drive e verifica seu SHA-256. A releitura só substitui pendências de arquivos que ainda não têm lançamentos nem conferências concluídas. O manifesto original e o arquivo no Drive são reutilizados.
- Arquivo com SHA-256 já conhecido não gera outra importação.
- Movimentos de arquivos diferentes com mesma data, tipo e líquido, mais descrição normalizada ou ID externo compatível, ficam fora do caixa como possíveis duplicatas. A pessoa escolhe **Mesclar com registro existente**; o valor existente é preservado e o novo documento fica registrado como evidência na auditoria.
- Essa comparação é conservadora e não detecta todas as diferenças de descrição, agregações ou mudanças de tipo entre fontes. Ela não decide que movimentos são iguais apenas por valor e data.

## Análise anual

O ano vigente é calculado no servidor com o fuso `America/Sao_Paulo`, independentemente da competência mensal selecionada. Todas as páginas do livro do ano são lidas; a tabela de apresentação não limita os totais. Meses sem registros aparecem como **Sem dados**. Aplicações, resgates e transferências não são tratados como receita/despesa operacional. Faturamento e recebíveis são separados do caixa. O histórico legado não é somado automaticamente, pois pode conter os mesmos movimentos.

## Configuração e limites

Utiliza a configuração OpenAI existente: `OPENAI_API_KEY` no servidor, modelo de `ai_config` quando válido ou `AI_MODEL`/padrão já usado pela aplicação. Sem chave, a interface explica a configuração e impede o processamento. Respostas da IA usam JSON Schema estrito e validação Zod; recusas, erros, leitura incompleta e moedas diferentes de BRL não são convertidos silenciosamente em dados confiáveis. `store: false` é enviado na requisição; os arquivos continuam sendo transmitidos à OpenAI para processamento.

Verificação de nota significa conferência documental e compatibilidade financeira. **Não há consulta de autenticidade, autorização ou situação fiscal em SEFAZ/prefeituras.** Uma nota sem pagamento identificado não comprova inadimplência. Documentos ilegíveis continuam dependendo de conferência. Conciliação muitos-para-um, diferenças de taxa, parcelamentos e moedas estrangeiras exigem análise adicional.

O fechamento é um registro operacional no sistema. A análise não substitui a escrituração e a validação da contabilidade.

## Persistência e validação

`finance_ai_reports` guarda um relatório por competência, com RLS pelo acesso ao módulo. As RPCs de conciliação, mesclagem, conferência de nota e fechamento são `SECURITY INVOKER`, restritas a usuários autenticados com acesso financeiro. Travas transacionais compartilhadas e triggers protegem também escritas diretas pela Data API. O fingerprint evita fechar com relatório mensal desatualizado.

As migrations `20261104153755` a `20261104155510` foram aplicadas com `supabase db push --linked --yes`. `tests/db/finance-ai-workflow.sql` executa testes reais em transação revertida, sem deixar registros de teste. Há testes de parsers, requisições estruturadas, cálculos, paginação completa, duplicatas, autorização e interface.

A leitura real pela OpenAI e a recuperação de originais pelo Drive precisam das credenciais do servidor. Esses dois serviços são simulados nos testes locais; as funções financeiras e os bloqueios foram verificados no banco vinculado.

## Ajustes após os primeiros documentos reais

- PIX: cabeçalhos `Pagador/Recebor` e `Tipo Transação`, valores como `+ R$ 40,10`, timestamps e paginação são reconhecidos. Totalizadores são conferidos contra as linhas; diferenças viram pendência, sem criar ajustes fictícios.
- Cielo: exports com cabeçalhos locais ZIP64 são reconstruídos a partir do diretório central antes da leitura. Linhas de filtros e totalizadores não são confundidas com o cabeçalho da tabela; vendas recusadas são excluídas. O arquivo real usado na regressão tem 26 vendas aprovadas e líquido de R$ 15.491,74.
- Observações (`findings`) ficam em Informações. A IA informa a severidade dos problemas em `issues`; apenas bloqueios e erros estruturais geram pendências obrigatórias. Falta de CNPJ em recibo/extrato não exige criar nota ou lançamento.
- Posições de investimentos são documentos de suporte. Capital contratado e saldo projetado não geram fluxo de caixa. Crédito efetivo de plataforma dentro de extrato bancário é receita recebida, não novo faturamento.
- Livro, pendências, auditoria e estado final da importação são gravados na mesma transação por `finance_commit_import`. Todas as pendências têm `affected_amount` definido; um lote inválido é revertido inteiro.
- A lista de documentos permite ajustar a competência sem reenviar o original. A movimentação conserva sua data e a alteração é auditada. Uma pendência documental já explicada pode ser encerrada com justificativa, sem inventar uma entrada ou saída; isso não substitui corrigir ou mesclar lançamentos vinculados.
- As migrations de recuperação preservam os 92 movimentos do extrato que falhou, corrigem créditos bancários classificados como faturamento e neutralizam posições de investimento importadas como caixa. As alterações ficam auditadas; registros revisados, conciliados ou de períodos fechados são preservados.
- Originais usados nos testes reais ficam somente no diretório local ignorado `tmp/finance-debug`. A suíte também contém fixtures sintéticos sem nomes, contas ou documentos pessoais.
