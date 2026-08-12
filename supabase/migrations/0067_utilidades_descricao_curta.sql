-- supabase/migrations/0067_utilidades_descricao_curta.sql
-- Encurta as descrições dos itens de Qualificação Docente seedados na 0066,
-- para que os cards do acervo de Utilidades fiquem compactos. Idempotente.

UPDATE public.utilidades_itens
SET descricao = 'Apresentação de 11/04/2026 do Parapedagógico: formação docente, critérios da Ectolab, categorias de atividades e fluxo de proposição de cursos.'
WHERE titulo = 'Qualificação Docente Ectolab 2026 — Apresentação';

UPDATE public.utilidades_itens
SET descricao = 'Pré-requisitos, autoverificação do Paradigma Consciencial, elementos avaliativos e os 37 aspectos da atuação parapedagógica para formação docente nas ICs.'
WHERE titulo = 'Parecer Nº 72/2020 UNICIN — Formação Docente';

UPDATE public.utilidades_itens
SET descricao = 'Requisitos para docência: voluntariado (1 ano Conscienciologia, 6 meses Ectolab), participação na DIP, cursos de autoenfrentamento e de campo, e certificado de formação docente.'
WHERE titulo = 'Critérios Docentes da Ectolab';

UPDATE public.utilidades_itens
SET descricao = '15 temas sugeridos de palestras em ectoplasmologia, de conceitos básicos a pesquisas científicas.'
WHERE titulo = 'Temas de Palestras em Ectoplasmologia';

UPDATE public.utilidades_itens
SET descricao = 'Regras de referenciação: ABNT (fontes da Socin), BEE (Conscienciologia) e modelo visual para palestras e mídias.'
WHERE titulo = 'Modelo de Slides para Curso — Orientações';

UPDATE public.utilidades_itens
SET descricao = 'Fluxo de 6 etapas, da ficha catalográfica (paratecnologico@ectolab.org) à aula piloto e aprovação.'
WHERE titulo = 'Fluxo de Proposição de Cursos da Ectolab';

UPDATE public.utilidades_itens
SET descricao = 'As 6 categorias de atividades parapedagógicas das ICs, de introdutórias a especialização.'
WHERE titulo = 'Parecer Nº 90/2025 UNICIN — Categorização de Atividades Parapedagógicas';

UPDATE public.utilidades_itens
SET descricao = 'Atividades da Ectolab por categoria do Parecer 90/2025, incluindo interinstitucionais e as fora do escopo do Conselho (DIP, OGB, preceptoria, Ectogroup).'
WHERE titulo = 'Atividades Parapedagógicas da Ectolab por Categoria';

UPDATE public.utilidades_itens
SET descricao = 'Campos obrigatórios: título, professor(a) coordenador(a), tipo e classificação da atividade parapedagógica.'
WHERE titulo = 'Ficha Catalográfica de Atividade Parapedagógica';
