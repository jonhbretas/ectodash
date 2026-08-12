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
      'Apresentação de 11/04/2026 do Parapedagógico: formação docente, critérios da Ectolab, categorias de atividades e fluxo de proposição de cursos.',
      'qualificacao_docente',
      ARRAY['qualificação', 'docente', 'ectolab', '2026', 'parapedagógico'],
      NULL
    ),
    (
      'Parecer Nº 72/2020 UNICIN — Formação Docente',
      'Pré-requisitos, autoverificação do Paradigma Consciencial, elementos avaliativos e os 37 aspectos da atuação parapedagógica para formação docente nas ICs.',
      'qualificacao_docente',
      ARRAY['parecer', 'unicin', 'formação', 'docente', '72/2020'],
      NULL
    ),
    (
      'Critérios Docentes da Ectolab',
      'Requisitos para docência: voluntariado (1 ano Conscienciologia, 6 meses Ectolab), participação na DIP, cursos de autoenfrentamento e de campo, e certificado de formação docente.',
      'qualificacao_docente',
      ARRAY['ectolab', 'critérios', 'docente', 'requisitos'],
      NULL
    ),
    (
      'Temas de Palestras em Ectoplasmologia',
      '15 temas sugeridos de palestras em ectoplasmologia, de conceitos básicos a pesquisas científicas.',
      'qualificacao_docente',
      ARRAY['palestras', 'temas', 'ectoplasmologia'],
      NULL
    ),
    (
      'Modelo de Slides para Curso — Orientações',
      'Regras de referenciação: ABNT (fontes da Socin), BEE (Conscienciologia) e modelo visual para palestras e mídias.',
      'qualificacao_docente',
      ARRAY['slides', 'modelo', 'bibliografia', 'abnt', 'bee'],
      NULL
    ),
    (
      'Fluxo de Proposição de Cursos da Ectolab',
      'Fluxo de 6 etapas, da ficha catalográfica (paratecnologico@ectolab.org) à aula piloto e aprovação.',
      'qualificacao_docente',
      ARRAY['fluxo', 'proposição', 'cursos', 'ficha'],
      NULL
    ),
    (
      'Parecer Nº 90/2025 UNICIN — Categorização de Atividades Parapedagógicas',
      'As 6 categorias de atividades parapedagógicas das ICs, de introdutórias a especialização.',
      'atividades_parapedagogicas',
      ARRAY['parecer', 'unicin', 'categorias', 'parapedagógicas', '90/2025'],
      NULL
    ),
    (
      'Atividades Parapedagógicas da Ectolab por Categoria',
      'Atividades da Ectolab por categoria do Parecer 90/2025, incluindo interinstitucionais e as fora do escopo do Conselho (DIP, OGB, preceptoria, Ectogroup).',
      'atividades_parapedagogicas',
      ARRAY['atividades', 'cursos', 'oficinas', 'categorias'],
      NULL
    ),
    (
      'Ficha Catalográfica de Atividade Parapedagógica',
      'Campos obrigatórios: título, professor(a) coordenador(a), tipo e classificação da atividade parapedagógica.',
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
