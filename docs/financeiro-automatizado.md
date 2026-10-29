# Financeiro automatizado

O módulo novo usa `finance_imports` como manifesto idempotente e `finance_ledger` como livro único. O arquivo deve ser salvo no Storage em produção usando `storage_path`; o SHA-256 impede reprocessamento do mesmo conteúdo. Cada linha mantém arquivo, aba, número da linha e `line_hash`.

## Fluxo

1. `POST /api/financeiro/import` recebe um ou mais arquivos.
2. O parser determinístico detecta CSV, XLS/XLSX, OFX ou PDF e lê todas as abas/tabelas possíveis.
3. Classificadores de alta confiança reconhecem transferências próprias, aplicações, resgates, rendimentos, tarifas, estornos, chargebacks e faturas.
4. A linha é inserida no livro com valores brutos, descontos, líquido, entrada/saída e explicação da classificação.
5. Linhas/documentos ambíguos entram em `finance_exceptions`; não há confirmação por lançamento.
6. `finance_consolidated_balance` e `finance_receivables` são calculadas pelo banco.

### Adaptadores e conferência

- Sisprime e PagBank: leem colunas bancárias, identificadores e a direção débito/crédito; data ou valor inválidos viram aviso de revisão, sem data atual ou valor zero inventado.
- Cielo: mantém valor bruto, taxa, líquido, data de venda e previsão de recebimento como receita faturada para comparar com o crédito posterior.
- Stripe: separa valor bruto, taxa, impostos e estornos e preserva o ID da transação.
- PDF textual é tentado pelo leitor atual. PDF digitalizado e comprovantes em imagem são arquivados e entram na revisão humana; OCR ainda não está conectado.
- A tela de conciliação sugere apenas pares únicos com líquido idêntico e até sete dias entre a previsão de depósito (ou data da venda) e o crédito bancário. A pessoa confirma; a API revalida ambos os registros e grava os vínculos e auditoria.
- Data fora da competência escolhida é sinalizada e exige confirmação humana do período.
- O fechamento mensal mantém um checklist de extratos, recebimentos, conciliação, cartões, notas e pagamentos. Só fecha com documentos importados, processamento concluído e nenhuma exceção aberta; períodos fechados bloqueiam novos envios.

## APIs

- `POST /api/financeiro/import`: upload múltiplo e processamento idempotente.
- `GET /api/financeiro/ledger?status=PENDENTE`: consulta rastreável do livro.
- `GET /api/financeiro/summary`: saldo consolidado, faturamento, recebimentos, recebíveis e exceções abertas.

## IA e evolução

Layouts desconhecidos devem ser enviados a um adaptador de IA que valide um JSON estrito antes da persistência. A IA pode sugerir tipo, entidade e confiança, mas os cálculos ficam no Postgres. As tabelas `finance_rules`, `finance_reconciliations` e `finance_exceptions` já suportam regras editáveis, revisão e conciliação sem alterar o contrato do livro.

## Aplicação

Execute a migration `0041_financial_automation.sql` no projeto Supabase. O financeiro legado continua funcionando durante a transição; relatórios novos devem consultar as views/tabelas `finance_*`.

O fluxo automatizado não fecha o mês por conta própria. O fechamento contábil e documentos sem extração ainda precisam de validação humana. A conciliação exata não cobre recebimentos agregados, liquidações parceladas com valores diferentes, chargebacks complexos ou relações muitos-para-um; estes casos ficam para conferência manual.
