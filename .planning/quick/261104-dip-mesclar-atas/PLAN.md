---
type: quick
slug: dip-mesclar-atas
date: 2026-11-04
---
Corrigir atualização dos registros da Dinâmica DIP a partir de atas.

Tasks:
1. RPC SECURITY DEFINER `mesclar_dip_da_ata` (aditiva; liberada para quem analisa atas; erro real sem permissão).
2. `src/lib/dips/salvar-dips-da-ata.ts`: regra única de duplicata (localidade+país+data compatível), país via `dip_localidades`, mescla via RPC, insert com retorno.
3. Usar em /analisar e /reunioes/analisar; erros de DIP na mensagem ao usuário; DIPs sem ata/sem país não somem em silêncio.
