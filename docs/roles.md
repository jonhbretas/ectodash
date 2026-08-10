# Papéis e níveis de acesso

O EctoDash tem dois mecanismos de acesso, somados:

1. **Papéis globais** (`profiles.role`, tipo `app_role`): papéis fixos, um
   por conta, garantidos pelo banco. `coordenador_geral`, `financeiro` e
   `voluntariado` são globais (não têm escopo).
2. **Cargos de acesso** (tabela `cargos`, migration 0043): um perfil pode
   ter **vários** cargos. Cada cargo é um **nível + escopo** (área ou
   localidade) + a lista de **módulos concedidos** (`cargo_modulos`).
   Ausência de cargos = voluntário comum.

## Os 5 papéis globais

| Papel (valor salvo) | O que significa na instituição |
|---|---|
| `coordenador_geral` | Acesso total a tudo, inclusive à gestão de cargos de qualquer pessoa. Único que pode alterar o papel de outra conta. |
| `coordenador_area` | Legado (ver cargos abaixo — o novo modelo usa `cargos`). Responsável por áreas via `lider_areas`. |
| `voluntariado` | Acesso total ao setor de voluntariado: vê e gerencia a equipe inteira (cadastro, edição, ativação), sem poder mudar papéis. |
| `voluntario_comum` | Voluntário comum — papel padrão de toda nova conta. |
| `financeiro` | Acesso aos dados e ao painel financeiro da instituição. |

## Cargos: nível + escopo (migration 0043)

Um cargo é definido por:

- **Nível** (`nivel_acesso`): o quanto o cargo coordena.
- **Escopo**: a área (`area_id` → `areas_institucionais`) ou a localidade
  (`localidade_id` → `voluntario_localidades`) sobre a qual o nível vale.
- **Módulos** (`cargo_modulos`): módulos concedidos a esse cargo, um a um —
  cada área/sub-área pode ter acessos independentes.

| Nível | Escopo | O que pode |
|---|---|---|
| `coordenador_area` | uma área | Gestão plena dos dados da própria área nos módulos concedidos; leitura no resto. Não herda sub-áreas. |
| `coordenador_geral_area` | uma área + todas as sub-áreas (herança via `area_mae_id`) | O mesmo do anterior com herança de sub-áreas, e pode criar/editar/remover cargos de coordenador dentro da própria área. |
| `coordenador_localidade` | uma localidade | Gestão plena dos registros que têm localidade (voluntários e DIPs da localidade); pode criar/editar/remover cargos dentro da localidade. |

Módulos concedíveis: `demandas`, `reunioes`, `dips`, `voluntarios`,
`eventos`, `projetos`, `pesquisas`, `proep`, `analise`, `analisar`,
`vendas`, `financeiro`, `utilidades`. `painel` e a configuração de áreas
são exclusivos do `coordenador_geral` (não são concedíveis por cargo).

Uma pessoa pode acumular cargos (ex.: `coordenador_geral_area` de
Paratecnológico + `coordenador_localidade` do Rio). O acesso efetivo é a
soma dos cargos + o papel global.

## Onde os cargos valem (dados por escopo)

- **Demandas** (`demandas.area_id`): o coordenador vê/edita as demandas da
  sua área (geral de área inclui sub-áreas).
- **Voluntários** (`voluntarios.area_id` e `localidade_id`): o coordenador
  vê e gerencia (via `criar_voluntario`/`atualizar_voluntario`) os
  voluntários da sua área/localidade — **sem nunca poder atribuir papéis**.
- **DIPs** (`dips.localidade_id`): o coordenador de localidade atualiza e
  exclui os DIPs da própria localidade.
- **Projetos** (`projetos.area_id`): o coordenador atualiza os projetos da
  sua área.
- Os demais módulos (eventos, reuniões, utilidades, pesquisas, PROEP...)
  continuam com as políticas atuais (leitura para todos, edição do criador
  ou coordenação) — os cargos adicionam gestão plena nos módulos concedidos
  onde o dado tem escopo.

## Gestão de cargos

Quem pode gerir cargos de quem:

- **`coordenador_geral`**: qualquer cargo, de qualquer pessoa.
- **`coordenador_geral_area` de X**: cargos cujo escopo está dentro da
  árvore de X (X e sub-áreas). Nunca os próprios cargos.
- **`coordenador_localidade` de L**: cargos de localidade L. Nunca os
  próprios cargos.

Regras de segurança (validadas em teste):

- O cargo novo/alterado precisa estar **dentro do escopo do gestor**
  (`pode_conceder_cargo` no WITH CHECK) — ninguém concede um nível/escopo
  que não tem.
- Ninguém edita/exclui os **próprios** cargos (autopromoção bloqueada).
- Um voluntário comum sem cargos não concede nada.

A gestão é feita na tela de detalhe do voluntário (seção "Cargos de
acesso"), visível para quem pode gerir. Cargos valem sobre a **conta
vinculada** — para voluntários sem conta vinculada, defina os cargos após
o vínculo (mesma regra do papel pretendido).

## Níveis de acesso por área (visão geral)

- **Financeiro** → papel `financeiro`: acesso total ao módulo financeiro.
- **Voluntariado** → papel `voluntariado`: acesso total à equipe
  (roster completo, cadastro e edição de qualquer voluntário).
- **Coordenador de área** → cargo `coordenador_area`/`coordenador_geral_area`
  com módulos à escolha: privilégios de configuração apenas da própria área
  (demandas, voluntários, projetos...) — o legado via `lider_areas` continua
  funcionando, mas o caminho novo é por cargo.
- **Coordenador geral de localidade** → cargo `coordenador_localidade`:
  voluntários e DIPs da localidade.
- **Coordenador geral** → tudo.

## Como convidar um voluntário com acesso

Dois caminhos:

1. **A tela (recomendado):** na /voluntarios, cadastre o voluntário e defina
   o papel pretendido. Quando ele entrar pelo link de acesso e escolher o
   próprio nome, o papel pretendido é aplicado automaticamente. Depois do
   vínculo, defina os cargos na tela de detalhe do voluntário.
2. **Script de convite** (conta sem roster): `npm run seed:coordinator --
   voluntario@instituicao.org --role=financeiro`. Se o `--role` for omitido,
   a conta é criada como `voluntario_comum`. Um papel digitado errado é
   rejeitado antes de qualquer convite ser enviado.

## Como mudar o papel de alguém que já está no sistema

Se a pessoa está vinculada ao roster, use a tela de edição do voluntário
(papel é campo do coordenador geral) e a seção de cargos do perfil. Para
uma conta sem roster, rode no SQL Editor do Supabase:

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
(`criar_voluntario`, `atualizar_voluntario`, `voluntario_manager_role` e o
novo `voluntario_manager_scope`, migrations 0017–0019, 0043–0045),
justamente para impedir que um `voluntariado`, um cargo de área ou um
`coordenador_area` altere papéis. A gestão de cargos usa RLS direta com
dois helpers: `pode_conceder_cargo` (WITH CHECK de INSERT/UPDATE — o escopo
novo precisa estar dentro do escopo do gestor) e `pode_gerir_cargos_de`
(USING de UPDATE/DELETE — o alvo já tem cargo no escopo do gestor; nunca
sobre si mesmo).

**Armadilha já vivida (0043→0044):** uma política de SELECT de `profiles`
que faça subconsulta direta em `voluntarios` cria ciclo com a política
"voluntarios self view" (que consulta `profiles`) → SQLSTATE 42P17 derruba
todo SELECT de voluntarios. Lookups de roster dentro de políticas devem
passar por helper SECURITY DEFINER (`voluntario_em_meu_escopo`).

**Outra armadilha (0043→0045):** ao recriar `criar_voluntario`/
`atualizar_voluntario`, manter a assinatura exata da 0030 (prefixo `p_` +
`telefone1`/`telefone2`) — senão o app cai num overload velho e a criação
devolve `null` silencioso. Em `pode_conceder_cargo`, referência a parâmetro
com mesmo nome de coluna deve ser qualificada (`pode_conceder_cargo.localidade_id`)
ou o PL/pgSQL quebra com 42702.
