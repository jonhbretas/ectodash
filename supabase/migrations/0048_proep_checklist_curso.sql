-- supabase/migrations/0048_proep_checklist_curso.sql
-- Checklist técnico-científico do CURSO PROEP (global, como os materiais):
-- pertence ao curso e não a uma turma específica.
-- Por isso, soltamos o NOT NULL de edition_id e cadastramos os itens com edition_id NULL.

alter table public.proep_checklist
  alter column edition_id drop not null;

insert into public.proep_checklist (edition_id, day_number, phase, title, sort_order) values
  -- Dia 0: D-30 a D-1 (preparação anterior ao PROEP)
  (null, 0, 'before', 'Confirmar presença da equipe da edição (P1)', 0),
  (null, 0, 'before', 'Informar à DIP os alunos e equipe confirmados (P1)', 1),
  (null, 0, 'before', 'Encomendar coffee break (Monitor)', 2),
  (null, 0, 'before', 'Adicionar alunos no grupo do WhatsApp e enviar cronograma (P1)', 3),
  (null, 0, 'before', 'Realizar entrevista médica dos alunos e autorizar inclusão no grupo (P2)', 4),
  (null, 0, 'before', 'Levar roupas de cama para lavanderia (Monitor)', 5),
  (null, 0, 'before', 'Verificar e comprar insumos básicos (Coordenadora do Bioenergologia)', 6),
  (null, 0, 'before', 'Testar equipamentos: Biowell, VegaTest, Colorgen, etc. (Equipe)', 7),
  (null, 0, 'before', 'Testar projetor e notebook (Equipe)', 8),
  (null, 0, 'before', 'Levar roupas limpas e arrumar macas (Rodízio)', 9),
  (null, 0, 'before', 'Agendar Reunião com Equipe (P1)', 10),
  (null, 0, 'before', 'Solicitar Limpeza do Laboratório (P1 ou Coordenadora do Bioenergologia)', 11),

  -- Dia 1: D0 – Sexta-feira (início do PROEP)
  (null, 1, 'before', 'Ligar projetor e testar passador de slides (Monitor)', 0),
  (null, 1, 'before', 'Abrir o drive do PROEP e aula de apresentação (Monitor)', 1),
  (null, 1, 'before', 'Receber e organizar coffee break às 17h (Monitor)', 2),
  (null, 1, 'before', 'Pegar fichas da DIP (Monitor)', 3),
  (null, 1, 'before', 'Preparar ambiente com aromatizador e organização das cadeiras (Monitor)', 4),
  (null, 1, 'before', 'Receber alunos, entregar pastas e orientar sobre os propés (Monitor)', 5),
  (null, 1, 'before', 'Encaminhar alunos à Dinâmica Interassistencial (Monitor)', 6),
  (null, 1, 'before', 'Guardar materiais e desligar equipamentos (Todos)', 7),
  (null, 1, 'before', 'Comprar galão de água e flor amarela (Monitor)', 8),
  (null, 1, 'before', 'Dar feedback das entrevistas à equipe (P2)', 9),
  (null, 1, 'before', 'Chegada da equipe com 1h de antecedência (Todos)', 10),
  (null, 1, 'before', 'Celulares no modo avião (Todos)', 11),
  (null, 1, 'before', 'Mensagem de Orientação sobre consumo de Café para Medição (P1)', 12),

  -- Dia 2: D+1 – Sábado (oficinas e atendimentos)
  (null, 2, 'before', 'Chegada com antecedência e preparação do ambiente (Monitor)', 0),
  (null, 2, 'before', 'Preparar café, buscar coffee na geladeira (Monitor)', 1),
  (null, 2, 'before', 'Acompanhar preenchimento do Autorganização Bioenergética (P1/P2)', 2),
  (null, 2, 'before', 'Preparar material da auriculoterapia (P2)', 3),
  (null, 2, 'before', 'Verificar preenchimento da anamnese e entregar à P2 (P1)', 4),
  (null, 2, 'before', 'Realizar Avaliação Holossomática (P2)', 5),
  (null, 2, 'before', 'Montar e testar equipamentos (Todos)', 6),
  (null, 2, 'before', 'Orientar alunos sobre campo de domingo (P1)', 7),

  -- Dia 3: D+2 – Domingo (oficinas avançadas e encerramento)
  (null, 3, 'before', 'Chegada com antecedência e organização do local (Todos)', 0),
  (null, 3, 'before', 'Imprimir relatórios do AutoOrgBio e inserir nas pastas (Monitor)', 1),
  (null, 3, 'before', 'Organizar ambiente das oficinas (Monitor)', 2),
  (null, 3, 'before', 'Executar Biowell e acoplamentos energéticos (Monitor/P2)', 3),
  (null, 3, 'before', 'Guiar exercício energético e mediação de debate (P1)', 4),
  (null, 3, 'before', 'Enviar relatórios Biowell via PDF aos alunos (P1)', 5),
  (null, 3, 'before', 'Realizar selfie do grupo antes do almoço (Todos)', 6),
  (null, 3, 'before', 'Organizar laboratório e limpar o ambiente (Todos)', 7),
  (null, 3, 'before', 'Enviar formulário de avaliação do curso no final curso (P1)', 8);
