---
status: complete
date: 2026-11-04
---
Causas: UPDATE em dips bloqueado por RLS sem erro (0 linhas contadas como atualizadas); update sobrescrevia participantes/observações; duplicata exigia data exata; DIP sem país descartado; /reunioes/analisar sempre inseria (duplicava ao reanalisar); erros só no console.

Correção: migration 20261104120000_mesclar_dip_da_ata.sql (aplicada), helper compartilhado salvar-dips-da-ata.ts + testes, integração nos dois fluxos.
