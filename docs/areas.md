# Áreas e líderes

O EctoDash modela a relação entre um `lider_area` e as áreas que ele lidera
com uma tabela própria, `public.lider_areas` — **não** uma coluna única em
`profiles`. A razão é uma regra institucional explícita: **um líder pode
liderar mais de uma área ao mesmo tempo**. Uma coluna única (`area_liderada`)
só permitiria uma área por líder, o que não reflete a realidade da
instituição — por isso `lider_areas` é uma tabela muitos-para-muitos
(`lider_id`, `area`), com uma linha por área liderada. Um líder com duas
áreas simplesmente tem duas linhas nessa tabela.

Assim como os papéis (`docs/roles.md`), atribuir ou remover uma área de um
líder é uma **atualização de dado**, não uma mudança de schema — por isso
roda direto no SQL Editor do painel do Supabase, e não vira um arquivo em
`supabase/migrations/`. Não existe (ainda) uma tela para isso; este
documento é o procedimento oficial até que uma exista.

## Como atribuir uma área a um líder

No SQL Editor do projeto no Supabase, rode:

```sql
insert into public.lider_areas (lider_id, area)
values (
  (select id from public.profiles where email = 'lider@instituicao.org'),
  'Pesquisa'
);
```

## Como atribuir uma SEGUNDA área ao mesmo líder

Exatamente como acima, com o mesmo `lider_id` e uma `area` diferente — isso é
a prova concreta de que o mesmo líder pode acumular múltiplas áreas
simultaneamente, sem precisar de nenhuma mudança de schema:

```sql
insert into public.lider_areas (lider_id, area)
values (
  (select id from public.profiles where email = 'lider@instituicao.org'),
  'Eventos'
);
```

Depois desse segundo `insert`, esse líder vê e edita as demandas de
**ambas** as áreas — "Pesquisa" e "Eventos" — sem qualquer configuração
adicional.

## Como remover a atribuição de uma área

```sql
delete from public.lider_areas
where lider_id = (select id from public.profiles where email = 'lider@instituicao.org')
  and area = 'Pesquisa';
```

**Atenção:** sem o filtro por `area`, o comando acima remove **todas** as
áreas atribuídas a esse líder de uma vez. Sempre confira o filtro antes de
rodar.

## Por que não existe uma tela para isso ainda

Esta fase (Fase 5) constrói o modelo de dados e a forma como as áreas de um
líder são aplicadas no controle de acesso do banco (RLS), não uma interface
de administração. Uma tela de gestão de áreas fica para uma fase futura que
adicionar um painel administrativo — até lá, os comandos SQL acima são o
processo completo, mesmo suportando múltiplas áreas por líder.

## Aviso para quem for mexer aqui no futuro

`public.lider_areas` é protegida por RLS (row-level security) para que
**somente** um `coordenador_geral` possa inserir, atualizar ou remover
linhas — inclusive a própria linha de um líder. Um líder autenticado só pode
**ler** suas próprias linhas em `lider_areas` (necessário para a interface
saber quais áreas mostrar), nunca escrever nelas.

Se uma fase futura adicionar uma regra genérica do tipo "o dono da linha pode
atualizar seus próprios dados" a essa tabela, **não** aplique isso a
`lider_areas` — isso abriria a porta para um líder se autoatribuir a
qualquer área da instituição e, com isso, ganhar acesso de edição a demandas
que não deveria poder ver. Esse é exatamente o mesmo risco de
autopromoção que `docs/roles.md` já descreve para `profiles.role`, aplicado
aqui à atribuição de área.
