-- Corrige o nome da função histórica e mantém os relatórios de rodízio
-- consistentes com a nomenclatura usada pela agenda da DIP.
update public.escala_alocacao
set funcao = 'Acoplador 12'
where funcao = 'Acoplador 2';
