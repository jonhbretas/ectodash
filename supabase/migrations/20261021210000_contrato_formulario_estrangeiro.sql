-- supabase/migrations/20261021210000_contrato_formulario_estrangeiro.sql
-- Alunos estrangeiros sem CPF: o formulário aceita passaporte, RNM/RNE ou
-- documento do país de origem. aluno_cpf passa a guardar a CHAVE do
-- documento (11 dígitos do CPF, ou "EST-" + letras/números do documento
-- estrangeiro) — continua sendo a base do índice único anti-duplicidade.
-- aluno_documento guarda o documento como a pessoa informou, para exibição.

alter table public.contrato_formulario_respostas add column aluno_documento text;

comment on column public.contrato_formulario_respostas.aluno_cpf is
  'Chave do documento para deduplicação: CPF (11 dígitos) ou EST-<documento estrangeiro normalizado>.';
