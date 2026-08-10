-- supabase/migrations/0049_proep_checklist_role.sql
-- Renomear phase → role, renumerar dias e cadastrar pós-curso.
-- O campo "role" indica a responsável pelo item (P1, P2, Monitor, Todos, etc.)
-- e alimenta o filtro de visão por função na aba Checklist.

alter table public.proep_checklist
  rename column phase to role;

-- Limpar itens antigos do curso (edition_id null = global)
delete from public.proep_checklist where edition_id is null;

-- Re-inserir com role, títulos limpos e numeração de dia atualizada:
--   -30 = Pré-curso (D-30 a D-1)
--    0  = Sexta-feira (D0)
--    1  = Sábado (D+1)
--    2  = Domingo (D+2)
--    3  = Pós-curso

insert into public.proep_checklist (edition_id, day_number, role, title, sort_order) values

  -- ============== PRÉ-CURSO (D-30 a D-1) ==============
  (null, -30, 'P1', 'Confirmar presença da equipe da edição', 0),
  (null, -30, 'P1', 'Informar à DIP os alunos e equipe confirmados', 1),
  (null, -30, 'Monitor', 'Encomendar coffee break', 2),
  (null, -30, 'P1', 'Adicionar alunos no grupo do WhatsApp e enviar cronograma', 3),
  (null, -30, 'P2', 'Realizar entrevista médica dos alunos e autorizar inclusão no grupo', 4),
  (null, -30, 'Monitor', 'Levar roupas de cama para lavanderia', 5),
  (null, -30, 'Coordenadora', 'Verificar e comprar insumos básicos', 6),
  (null, -30, 'Equipe', 'Testar equipamentos: Biowell, VegaTest, Colorgen, etc.', 7),
  (null, -30, 'Equipe', 'Testar projetor e notebook', 8),
  (null, -30, 'Rodízio', 'Levar roupas limpas e arrumar macas', 9),
  (null, -30, 'P1', 'Agendar Reunião com Equipe', 10),
  (null, -30, 'P1', 'Solicitar Limpeza do Laboratório', 11),

  -- ============== SEXTA-FEIRA (D0) ==============
  (null, 0, 'Monitor', 'Ligar projetor e testar passador de slides', 0),
  (null, 0, 'Monitor', 'Abrir o drive do PROEP e aula de apresentação', 1),
  (null, 0, 'Monitor', 'Receber e organizar coffee break às 17h', 2),
  (null, 0, 'Monitor', 'Pegar fichas da DIP', 3),
  (null, 0, 'Monitor', 'Preparar ambiente com aromatizador e organização das cadeiras', 4),
  (null, 0, 'Monitor', 'Receber alunos, entregar pastas e orientar sobre os propés', 5),
  (null, 0, 'Monitor', 'Encaminhar alunos à Dinâmica Interassistencial', 6),
  (null, 0, 'Todos', 'Guardar materiais e desligar equipamentos', 7),
  (null, 0, 'Monitor', 'Comprar galão de água e flor amarela', 8),
  (null, 0, 'P2', 'Dar feedback das entrevistas à equipe', 9),
  (null, 0, 'Todos', 'Chegada da equipe com 1h de antecedência', 10),
  (null, 0, 'Todos', 'Celulares no modo avião', 11),
  (null, 0, 'P1', 'Mensagem de orientação sobre consumo de café para medição', 12),

  -- ============== SÁBADO (D+1) ==============
  (null, 1, 'Monitor', 'Chegada com antecedência e preparação do ambiente', 0),
  (null, 1, 'Monitor', 'Preparar café, buscar coffee na geladeira', 1),
  (null, 1, 'P1', 'Acompanhar preenchimento do Autorganização Bioenergética', 2),
  (null, 1, 'P2', 'Preparar material da auriculoterapia', 3),
  (null, 1, 'P1', 'Verificar preenchimento da anamnese e entregar à P2', 4),
  (null, 1, 'P2', 'Realizar Avaliação Holossomática', 5),
  (null, 1, 'Todos', 'Montar e testar equipamentos', 6),
  (null, 1, 'P1', 'Orientar alunos sobre campo de domingo', 7),

  -- ============== DOMINGO (D+2) ==============
  (null, 2, 'Todos', 'Chegada com antecedência e organização do local', 0),
  (null, 2, 'Monitor', 'Imprimir relatórios do AutoOrgBio e inserir nas pastas', 1),
  (null, 2, 'Monitor', 'Organizar ambiente das oficinas', 2),
  (null, 2, 'Monitor', 'Executar Biowell e acoplamentos energéticos', 3),
  (null, 2, 'P1', 'Guiar exercício energético e mediação de debate', 4),
  (null, 2, 'P1', 'Enviar relatórios Biowell via PDF aos alunos', 5),
  (null, 2, 'Todos', 'Realizar selfie do grupo antes do almoço', 6),
  (null, 2, 'Todos', 'Organizar laboratório e limpar o ambiente', 7),
  (null, 2, 'P1', 'Enviar formulário de avaliação do curso no final', 8),

  -- ============== PÓS-CURSO ==============
  (null, 3, 'P1', 'Enviar relatórios finais aos alunos', 0),
  (null, 3, 'P1', 'Devolver materiais emprestados', 1),
  (null, 3, 'Monitor', 'Limpar e organizar laboratório definitivamente', 2),
  (null, 3, 'Coordenadora', 'Atualizar registros e fechar edição do PROEP', 3);
