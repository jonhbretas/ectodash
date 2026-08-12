-- supabase/migrations/0066_utilidades_qualificacao_docente.sql
-- Seed do material de "Qualificação Docente Ectolab 2026" no acervo de
-- Utilidades, vinculado à área Parapedagógico. O conteúdo vem da
-- apresentação de 11/04/2026 (Parecer 72/2020, critérios docentes da
-- Ectolab, Parecer 90/2025, fluxo de proposição de cursos e ficha
-- catalográfica). As categorias são livres desde a migration 0057, então
-- não há mudança de constraint — só INSERTs idempotentes.

INSERT INTO public.utilidades_itens (titulo, descricao, categoria, tags, area_id, criado_por)
SELECT v.titulo, v.descricao, v.categoria, v.tags, ai.id, prof.id
FROM (
  VALUES
    (
      'Qualificação Docente Ectolab 2026 — Apresentação',
      'Apresentação de 11/04/2026 organizada pelo Parapedagógico/Paratecnológico (Profª Ana Paula do Prado, Profª Celeste Silveira e Paulo Battistella). Cobre formação docente (Parecer 72/2020 UNICIN), critérios docentes da Ectolab, categorização de atividades parapedagógicas (Parecer 90/2025 UNICIN) e fluxo de proposição de cursos.',
      'qualificacao_docente',
      ARRAY['qualificação', 'docente', 'ectolab', '2026', 'parapedagógico'],
      NULL
    ),
    (
      'Parecer Nº 72/2020 UNICIN — Formação Docente',
      'Formação docente básica nas ICs. Pré-requisitos: 6 meses de voluntariado; formação conscienciológica (Fundamentação com mínimo 40h/aula, Aprofundamento em Autopesquisa e Curso de Campo); prova de conhecimentos com acerto mínimo de 70%. Inclui autoverificação do Paradigma Consciencial (5 pontos), 10 elementos avaliativos e os 37 aspectos da atuação parapedagógica do docente recém-formado.',
      'qualificacao_docente',
      ARRAY['parecer', 'unicin', 'formação', 'docente', '72/2020'],
      NULL
    ),
    (
      'Critérios Docentes da Ectolab',
      'Pré-requisitos para docência na Ectolab: voluntário na Conscienciologia há, no mínimo, 1 ano; voluntário na ECTOLAB há, no mínimo, 6 meses; participação regular na Dinâmica Interassistencial de Paracirurgia (DIP); curso Ectoplasmia Interassistencial EAD; cursos de autoenfrentamento (ex.: ECP1, Conscin-cobaia); cursos de campo parapsíquico (ex.: Campo Interassistencial Paracirúrgico, EPPI, ECP2); certificado de formação básica docente em instituição conscienciocêntrica.',
      'qualificacao_docente',
      ARRAY['ectolab', 'critérios', 'docente', 'requisitos'],
      NULL
    ),
    (
      'Temas de Palestras em Ectoplasmologia',
      'Lista de 15 temas sugeridos para palestras: o que é ectoplasma (conceitos básicos), anátomo-fisiologia do ectoplasta, aplicação prática da ectoplasmia, síndrome ectoplásmica, autocuidado no uso de ectoplasmia, benefícios evolutivos, relação Projeciologia e Ectoplasmologia, exteriorização de energias ectoplásmicas, otimizações para o ectoplasta, desenvolvimento da ectoplasmia, influência do ectoplasta nas pessoas e ambientes, ectoplasmia paraterapêutica, efeitos físicos, ectoplasmia como valor evolutivo e pesquisas científicas.',
      'qualificacao_docente',
      ARRAY['palestras', 'temas', 'ectoplasmologia'],
      NULL
    ),
    (
      'Modelo de Slides para Curso — Orientações',
      'Regras de referenciação bibliográfica: ABNT para fontes da Socin, Bibliografia Específica Exaustiva (BEE) para obras da Conscienciologia, e modelo visual próprio para palestras/mídias sociais (exemplo: "Referenciações pesquisísticas em palestras ou mídias"; autoria Neida Cardozo).',
      'qualificacao_docente',
      ARRAY['slides', 'modelo', 'bibliografia', 'abnt', 'bee'],
      NULL
    ),
    (
      'Fluxo de Proposição de Cursos da Ectolab',
      'Fluxo de proposição: 1) envio da ficha catalográfica por e-mail para paratecnologico@ectolab.org, com cópia para parapedagogico@ectolab.org; 2) revisão de conteúdo e forma (CONFOR) pela equipe; 3) revisões com o docente autor; 4) revisão da aula expositiva, sequência didática e materiais; 5) agendamento da aula piloto; 6) curso revisado, aprovado e pronto para aplicação.',
      'qualificacao_docente',
      ARRAY['fluxo', 'proposição', 'cursos', 'ficha'],
      NULL
    ),
    (
      'Parecer Nº 90/2025 UNICIN — Categorização de Atividades Parapedagógicas',
      'Seis categorias de atividades parapedagógicas das ICs: 1) Atividades Introdutórias e Cursos Livres; 2) Atividades de Fundamentação (não se aplica na Ectolab); 3) Atividades Avançadas; 4) Atividades de Campo; 5) Atividades Institucionais de Qualificação; 6) Atividades de Especialização.',
      'atividades_parapedagogicas',
      ARRAY['parecer', 'unicin', 'categorias', 'parapedagógicas', '90/2025'],
      NULL
    ),
    (
      'Atividades Parapedagógicas da Ectolab por Categoria',
      'Relação das atividades da Ectolab organizadas pelas categorias do Parecer 90/2025 UNICIN (palestras, EctoLive, cursos assíncronos, oficinas presenciais, cursos de campo, formação do voluntário, imersões), incluindo atividades interinstitucionais e as atividades fora do escopo do Conselho de Parapedagogia (DIP, OGB, Preceptoria em Ectoplasmia, Ectogroup, pedidos de paracirurgia/tenepes, parcerias de pesquisa e Fórum de Ectoplasmologia).',
      'atividades_parapedagogicas',
      ARRAY['atividades', 'cursos', 'oficinas', 'categorias'],
      NULL
    ),
    (
      'Ficha Catalográfica de Atividade Parapedagógica',
      'Ficha para proposição de atividades parapedagógicas. Campos: título da atividade/documento; professor(a) coordenador(a); tipo de atividade (dinâmica, curso de campo, palestra, curso de imersão, curta duração até 16h, longa duração acima de 16h, workshop, fórum, congresso, oficina ou outros); classificação (proposta institucional da ECTOLAB, proposta de pesquisador independente, parceria interinstitucional ou atividade a ser realizada no CEAEC). Todas as respostas são obrigatórias.',
      'atividades_parapedagogicas',
      ARRAY['ficha', 'catalográfica', 'curso', 'proposição'],
      NULL
    )
) AS v(titulo, descricao, categoria, tags, area_ord)
CROSS JOIN LATERAL (
  SELECT ai.id
  FROM public.areas_institucionais ai
  WHERE ai.nome = 'Parapedagógico'
  ORDER BY ai.id
  LIMIT 1
) ai
CROSS JOIN LATERAL (
  SELECT id
  FROM public.profiles
  WHERE role = 'coordenador_geral'
  ORDER BY created_at
  LIMIT 1
) prof
WHERE NOT EXISTS (
  SELECT 1 FROM public.utilidades_itens u
  WHERE u.titulo = v.titulo
);
