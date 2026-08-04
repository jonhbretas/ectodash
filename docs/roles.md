# Papéis de acesso

O EctoDash tem 4 papéis fixos. Toda conta tem exatamente um. Essa regra é
garantida pelo próprio banco de dados (um tipo `enum` do Postgres), não por
uma tela — não existe (ainda) uma tela para gerenciar papéis, então este
documento é o procedimento oficial até que uma exista.

Adicionar um quinto papel é uma mudança de schema (uma nova migração), não
uma opção de configuração que se liga e desliga.

## Os 4 papéis

| Papel (valor salvo) | O que significa na instituição |
|---|---|
| `coordenador_geral` | Visão geral de todas as demandas/projetos, único papel que pode alterar o papel de outra pessoa. |
| `lider_area` | Responsável por uma área/projeto específico da instituição. |
| `voluntario_comum` | Voluntário comum — papel padrão de toda nova conta convidada sem papel explícito. |
| `financeiro` | Acesso aos dados e ao painel financeiro da instituição. |

## Como convidar um voluntário com um papel

Use o script de convite, informando o e-mail institucional e (opcionalmente)
o papel:

```bash
npm run seed:coordinator -- voluntario@instituicao.org --role=financeiro
```

Se o `--role` for omitido, a conta é criada como `voluntario_comum` — o
papel de menor privilégio, nunca um papel mais poderoso por padrão:

```bash
npm run seed:coordinator -- voluntario@instituicao.org
```

O comando aceita `--role=` antes ou depois do e-mail. Um papel digitado
errado é rejeitado antes de qualquer convite ser enviado, com uma mensagem
listando os 4 valores aceitos.

## Como mudar o papel de alguém que já está no sistema

Isso é uma **atualização de dado**, não uma mudança de schema — por isso
roda direto no SQL Editor do painel do Supabase, e **não** vira um arquivo em
`supabase/migrations/`. A regra do projeto é que toda mudança de *schema*
(tabelas, colunas, tipos) vira migração versionada; um `role` diferente para
uma pessoa não é uma mudança de schema, é só um valor de linha — escrever uma
migração para cada promoção de voluntário encheria o histórico de migrações
com eventos que não têm nada a ver com a estrutura do banco.

No SQL Editor do projeto no Supabase, rode:

```sql
update public.profiles
set role = 'lider_area'
where email = 'voluntario@instituicao.org';
```

**Atenção:** sem o `where email = '...'`, esse comando muda o papel de
**todas** as contas do sistema de uma vez. Sempre confira o filtro antes de
rodar.

## Por que não existe uma tela para isso ainda

A Fase 2 constrói o modelo de papéis e a forma como eles são aplicados no
banco, não uma interface de administração. Uma tela de gestão de papéis fica
para uma fase futura que adicionar um painel administrativo — até lá, os dois
caminhos acima (convite com `--role` e atualização direta no SQL Editor) são
o processo completo.

## Aviso para quem for mexer aqui no futuro

O controle de acesso do banco (RLS — row-level security) funciona por linha
inteira, não por coluna. Se uma fase futura permitir que o próprio voluntário
edite campos do seu perfil (por exemplo, nome de exibição), **não** basta
adicionar uma regra genérica do tipo "o dono da linha pode atualizar seu
próprio perfil" — isso também abriria a porta para o voluntário mudar o
próprio `role` e se autopromover a `coordenador_geral`.

As duas alternativas seguras são:

1. Restringir, a nível de banco, quais colunas o papel autenticado pode
   escrever (`GRANT UPDATE (coluna, ...)`), deixando `role` de fora.
2. Um gatilho (`trigger`) que rejeita qualquer tentativa de mudar `role`
   vinda de alguém que não seja `coordenador_geral`.

Veja a pesquisa da Fase 2 (`.planning/phases/02-role-based-access-control/02-RESEARCH.md`,
Pattern 3) para o raciocínio completo por trás desse aviso.
