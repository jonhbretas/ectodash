# Áreas e coordenadores

O EctoDash modela a relação entre um `coordenador_area` e as áreas que ele
coordena com a tabela `public.lider_areas` — **não** uma coluna única em
`profiles`. A razão é uma regra institucional explícita: **um coordenador
pode coordenar mais de uma área ao mesmo tempo**. Uma coluna única
(`area_coordenada`) só permitiria uma área por coordenador, o que não
reflete a realidade da instituição — por isso `lider_areas` é uma tabela
muitos-para-muitos (`lider_id`, `area`), com uma linha por área coordenada.
Um coordenador com duas áreas simplesmente tem duas linhas nessa tabela.

> Nomenclatura (2026-08-04): o papel `lider_area` foi renomeado para
> `coordenador_area` ("Coordenador de área") no banco (migration 0016). A
> tabela mantém o nome histórico `lider_areas`.

## Áreas canônicas da instituição

Derivadas da planilha oficial de voluntários (2026-08-04), usadas como
`area_atuacao` no roster:

| Área | Coordenadores (2026-08-04) |
|---|---|
| Financeiro | Rinaldo Nishimura (financeiro) |
| Voluntariado | Regina Krupka (voluntariado) |
| Comunicação e Eventos | Eliane Amarante |
| Parapedagógico | Ana Prado |
| Paratecnológico - DIP | Luciano Guerini, Máris Polo Paz |
| Paratecnológico - Bioenergologia | Lidia Bolfe |
| Paratecnológico | — |
| Internacional | Francisco Ávila |
| Pesquisa | — |
| Coordenação Geral | Jonathan Bretas (coordenador_geral), Miryan Akemi Ishikawa (unidade São Paulo), Jose Luis Ara Sobrinho (unidade Curitiba) |

## Como atribuir uma área a um coordenador

O caminho recomendado é a tela /voluntarios → editar o voluntário → campo
"Áreas de coordenação" (visível apenas para o coordenador geral). Quando o
voluntário ainda não vinculou a conta, as áreas ficam gravadas no roster
(`voluntarios.areas_lideradas`) e são materializadas em `lider_areas` no
momento do vínculo (`vincular_meu_cadastro()`).

Alternativa manual (conta sem roster), no SQL Editor do Supabase:

```sql
insert into public.lider_areas (lider_id, area)
values (
  (select id from public.profiles where email = 'coordenador@instituicao.org'),
  'Paratecnológico - DIP'
);
```

## Como atribuir uma SEGUNDA área ao mesmo coordenador

Exatamente como acima, com o mesmo `lider_id` e uma `area` diferente — isso
é a prova concreta de que o mesmo coordenador pode acumular múltiplas áreas
simultaneamente, sem precisar de nenhuma mudança de schema:

```sql
insert into public.lider_areas (lider_id, area)
values (
  (select id from public.profiles where email = 'coordenador@instituicao.org'),
  'Eventos'
);
```

Depois desse segundo `insert`, esse coordenador vê e edita as demandas e os
voluntários de **ambas** as áreas.

## Como remover a atribuição de uma área

```sql
delete from public.lider_areas
where lider_id = (select id from public.profiles where email = 'coordenador@instituicao.org')
  and area = 'Pesquisa';
```

**Atenção:** sem o filtro por `area`, o comando acima remove **todas** as
áreas atribuídas a esse coordenador de uma vez. Sempre confira o filtro
antes de rodar.

## Aviso para quem for mexer aqui no futuro

`public.lider_areas` é protegida por RLS (row-level security) para que
**somente** um `coordenador_geral` possa inserir, atualizar ou remover
linhas. Um `coordenador_area` autenticado só pode **ler** suas próprias
linhas em `lider_areas` (necessário para a interface saber quais áreas
mostrar), nunca escrever nelas — e o escopo de gestão de voluntários
(`voluntario_manager_role()`, migration 0017) cruza as `lider_areas` do
chamador com a área do voluntário alvo.

Se uma fase futura adicionar uma regra genérica do tipo "o dono da linha
pode atualizar seus próprios dados" a essa tabela, **não** aplique isso a
`lider_areas` — isso abriria a porta para um coordenador se autoatribuir
qualquer área da instituição e, com isso, ganhar acesso de edição a
demandas e voluntários que não deveria poder ver. Esse é exatamente o mesmo
risco de autopromoção que `docs/roles.md` já descreve para `profiles.role`,
aplicado aqui à atribuição de área.
