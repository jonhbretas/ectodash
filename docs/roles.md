# Papéis de acesso

O EctoDash tem 5 papéis fixos. Toda conta tem exatamente um. Essa regra é
garantida pelo próprio banco de dados (um tipo `enum` do Postgres), não por
uma tela — não existe (ainda) uma tela para gerenciar papéis de quem já tem
acesso, então este documento é o procedimento oficial até que uma exista.
(Cadastro e edição de voluntários na equipe, incluindo o *papel pretendido*
antes do vínculo, acontecem pela tela /voluntarios.)

Adicionar um sexto papel é uma mudança de schema (uma nova migração), não
uma opção de configuração que se liga e desliga.

## Os 5 papéis

| Papel (valor salvo) | O que significa na instituição |
|---|---|
| `coordenador_geral` | Visão geral de todas as demandas/projetos, único papel que pode alterar o papel de outra pessoa. |
| `coordenador_area` | Responsável por uma área específica (renomeado de `lider_area` em 2026-08-04). Vê/edita as demandas e os voluntários da própria área. |
| `voluntariado` | Acesso total ao setor de voluntariado: vê e gerencia a equipe inteira (cadastro, edição, ativação), sem poder mudar papéis. |
| `voluntario_comum` | Voluntário comum — papel padrão de toda nova conta. |
| `financeiro` | Acesso aos dados e ao painel financeiro da instituição. |

## Papéis por área e "papel pretendido" (roster)

A tela de Voluntários trabalha com a tabela `public.voluntarios` (migration
0017): o cadastro institucional existe **antes** da conta de acesso. Cada
linha do roster pode carregar um `role` e `areas_lideradas` **pretendidos** —
são aplicados quando o voluntário vincula a conta na primeira entrada
(/vincular), com duas proteções no banco (`vincular_meu_cadastro()`):

1. `coordenador_geral` nunca é auto-concedido pelo vínculo — quem já é
   coordenador_geral não é rebaixado, e ninguém mais recebe esse papel.
2. Um voluntário comum não consegue mudar o próprio papel depois do vínculo
   (nenhum caminho de escrita do roster aceita mudança de papel fora do
   `coordenador_geral`).

Mudar o papel pretendido de alguém que ainda não vinculou = editar o
voluntário na tela /voluntarios (papel e áreas de coordenação são campos do
formulário de edição, visíveis apenas para o coordenador geral).

## Níveis de acesso por área

A instituição organiza o acesso por área de atuação:

- **Financeiro** → papel `financeiro`: acesso total ao módulo financeiro.
- **Voluntariado** → papel `voluntariado`: acesso total à equipe
  (roster completo, cadastro e edição de qualquer voluntário).
- **Coordenador de área** → papel `coordenador_area`: privilégios de
  configuração apenas da própria área — demandas da área (RLS via
  `lider_areas`) e voluntários cuja área de atuação consta nas suas
  `lider_areas`. Não pode mudar papéis nem ver voluntários de outras áreas.
- **Coordenador geral** → tudo.

## Como convidar um voluntário com um papel

Dois caminhos:

1. **A tela (recomendado):** na /voluntarios, cadastre o voluntário e defina
   o papel pretendido. Quando ele entrar pelo link de acesso e escolher o
   próprio nome, o papel pretendido é aplicado automaticamente.
2. **Script de convite** (conta sem roster): `npm run seed:coordinator -- 
   voluntario@instituicao.org --role=financeiro`. Se o `--role` for omitido,
   a conta é criada como `voluntario_comum`. Um papel digitado errado é
   rejeitado antes de qualquer convite ser enviado.

## Como mudar o papel de alguém que já está no sistema

Se a pessoa está vinculada ao roster, use a tela de edição do voluntário
(papel é campo do coordenador geral). Para uma conta sem roster, rode no
SQL Editor do Supabase:

```sql
update public.profiles
set role = 'coordenador_area'
where email = 'voluntario@instituicao.org';
```

**Atenção:** sem o `where email = '...'`, esse comando muda o papel de
**todas** as contas do sistema de uma vez. Sempre confira o filtro antes de
rodar.

## Aviso para quem for mexer aqui no futuro

O controle de acesso do banco (RLS — row-level security) funciona por linha
inteira, não por coluna. As escritas no roster **não** usam políticas RLS de
UPDATE/INSERT — usam funções SECURITY DEFINER com checagem interna de papel
(`criar_voluntario`, `atualizar_voluntario`, `voluntario_manager_role`,
migrations 0017–0019), justamente para impedir que um `voluntariado` ou
`coordenador_area` altere papéis. Se uma fase futura adicionar políticas de
escrita diretas a `public.voluntarios` ou a `public.profiles`, o risco de
autopromoção reaparece (veja a pesquisa da Fase 2,
`.planning/phases/02-role-based-access-control/02-RESEARCH.md`, Pattern 3).
