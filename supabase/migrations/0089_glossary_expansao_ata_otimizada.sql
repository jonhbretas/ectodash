-- supabase/migrations/0089_glossary_expansao_ata_otimizada.sql
-- Expansão do Dicionário para geração de atas (Orientações 03_ORIENTACAO_GERACAO_ATA.md §7)
-- Cobre erros recorrentes de ASR: pessoas, siglas institucionais e jargões.
-- Todos os termos usam ON CONFLICT DO NOTHING para não duplicar com 0079.
-- Fonte: 03_ORIENTACAO_GERACAO_ATA.md + 01_RESUMO_COMPLETO_REFERENCIA.md

-- Pessoas — variações corrompidas pela transcrição (mapeiam para nome canônico)
insert into public.glossary_terms (term, replacement, description, criado_por)
select term, replacement, description, p.id from (values
  ('Magritte', 'Margrit Stüpp', 'ASR: variação de Margrit Stüpp'),
  ('Margarete', 'Margrit Stüpp', 'ASR: variação de Margrit Stüpp'),
  ('Reinaldo', 'Rinaldo Nishimura', 'ASR: variação de Rinaldo Nishimura'),
  ('Renato', 'Rinaldo Nishimura', 'ASR: variação de Rinaldo Nishimura'),
  ('Arnaldo', 'Rinaldo Nishimura', 'ASR: variação de Rinaldo Nishimura'),
  ('Juliano', 'Giuliano Ginani', 'ASR: variação de Giuliano Ginani'),
  ('Juliana', 'Giuliano Ginani', 'ASR: variação de Giuliano Ginani'),
  ('Lúcio', 'Giuliano Ginani', 'ASR: variação de Giuliano Ginani'),
  ('Lúcia', 'Giuliano Ginani', 'ASR: variação de Giuliano Ginani'),
  ('Mili', 'Myriam Sanchez', 'ASR: variação de Myriam Sanchez (coordenação)'),
  ('Emília', 'Myriam Sanchez', 'ASR: variação de Myriam Sanchez'),
  ('Paulinho', 'Paulo Battistela', 'ASR: variação de Paulo Battistela'),
  ('para pedagógico', 'Paulo Battistela', 'ASR: variação de Parapedagógico Ectolab = Paulo Battistela'),
  ('Dalvante', 'Dalvan Brum', 'ASR: variação de Dalvan Brum'),
  ('Dal Van', 'Dalvan Brum', 'ASR: variação de Dalvan Brum'),
  ('Iara', 'Ara', 'ASR: variação de Ara'),
  ('Haras', 'Ara', 'ASR: variação de Ara'),
  ('Gorete', 'Goretti Lopes', 'ASR: variação de Goretti Lopes'),
  ('Marcos Lula', 'Marcos Vinícius Ulaf', 'ASR: variação de Marcos Vinícius Ulaf'),
  ('Celestes', 'Celeste Silveira', 'ASR: variação de Celeste Silveira'),
  ('Hernante', 'Hernandes', 'ASR: variação de Hernandes'),
  ('John', 'Jonathan Brêtas', 'ASR: variação de Jonathan Brêtas'),
  ('Jonatham', 'Jonathan Brêtas', 'ASR: variação de Jonathan Brêtas'),
  ('Lidia Bolfe', 'Lídia Bolfe', 'ASR: acento em Lídia Bolfe'),
  ('Ana Paula do Prado', 'Ana Paula do Prado', 'Nome canônico para vincular corretamente — evita truncamento'),
  ('Miryan Akemi', 'Miryan Akemi Ishikawa', 'Desambiguação: Miryan Akemi Ishikawa (Virada/POLICONS)'),
  ('Sônia', 'Sônia', 'Nome preservado para busca — evita normalização errada'),
  ('Walmir', 'Walmir', 'Monitor Curso Autorização Energética — nome canônico'),
  ('Will', 'Will', 'Epicon RS — preservar'),
  ('Félix', 'Félix', 'Epicon RJ — preservar com acento')
) as t(term, replacement, description)
cross join lateral (select id from public.profiles order by created_at limit 1) p
on conflict (term) do nothing;

-- Termos institucionais e siglas — ASR clássico
insert into public.glossary_terms (term, replacement, description, criado_por)
select term, replacement, description, p.id from (values
  ('cinto', 'Sympla', 'ASR: Sympla como cinto'),
  ('simpla', 'Sympla', 'ASR: Sympla como simpla'),
  ('simbla', 'Sympla', 'ASR: Sympla como simbla'),
  ('sigla', 'Sympla', 'ASR: Sympla como sigla quando contexto é inscrição'),
  ('o Simple', 'Sympla', 'ASR: Sympla como o Simple'),
  ('unisim', 'UNICIN', 'ASR: UNICIN como unisim'),
  ('unissin', 'UNICIN', 'ASR: UNICIN como unissin'),
  ('unir sim', 'UNICIN', 'ASR: UNICIN como unir sim'),
  ('ceec', 'CEAEC', 'ASR: CEAEC como ceec'),
  ('CEF', 'CEAEC', 'ASR: CEAEC como CEF quando contexto é laboratório/CEAEC'),
  ('SESC', 'CEAEC', 'ASR: CEAEC como SESC (erro de sigla)'),
  ('cearex', 'CEAEC', 'ASR: CEAEC como cearex'),
  ('SIAEC', 'CEAEC', 'ASR: CEAEC como SIAEC — já em 0079, reforço'),
  ('policon', 'POLICONS', 'ASR: POLICONS como policon'),
  ('policons', 'POLICONS', 'ASR: POLICONS preservado/normalizado'),
  ('epicon', 'Epicon', 'ASR: Epicon normalizado'),
  ('picon', 'Epicon', 'ASR: Epicon como picon'),
  ('epicons', 'Epicons', 'ASR: Epicons normalizado'),
  ('DEEP', 'DIP', 'ASR: DIP como DEEP'),
  ('deep', 'DIP', 'ASR: DIP como deep'),
  ('electolado', 'Ectolab', 'ASR: Ectolab como electolado'),
  ('dectolab', 'Ectolab', 'ASR: Ectolab como dectolab'),
  ('ectolab', 'Ectolab', 'ASR: Ectolab preservado (caixa)'),
  ('ecovi', 'ECOVI', 'ASR: ECOVI convênio de diárias'),
  ('Hector Dash', 'dashboard', 'ASR: dashboard de eventos como Hector Dash'),
  ('conciologia', 'conscienciologia', 'ASR: conscienciologia como conciologia'),
  ('com sociologia', 'conscienciologia', 'ASR: conscienciologia como com sociologia'),
  ('ectoplasmose', 'ectoplasmólogo', 'ASR: ectoplasmólogo como ectoplasmose'),
  ('para cirurgia', 'paracirurgia', 'ASR: paracirurgia como para cirurgia'),
  ('paracirúrgia', 'paracirurgia', 'ASR: paracirurgia acentuada'),
  ('pics', 'PIX', 'ASR: PIX como pics'),
  ('piques', 'PIX', 'ASR: PIX como piques'),
  ('pix', 'PIX', 'ASR: PIX normalizado para maiúsculas'),
  ('ICNET', 'ICNET', 'Plataforma ICNET — preservar caixa'),
  ('tenepes', 'tenepes', 'Jargão conscienciologia — preservar'),
  ('verbete', 'verbete', 'Jargão conscienciologia — preservar'),
  ('Paraambulatório', 'Paraambulatório', 'Curso Escola de Paraambulatório — preservar'),
  ('Virada de Consciência', 'Virada de Consciência', 'Evento Virada — preservar para extração'),
  ('Jornada da Consciência', 'Jornada da Consciência', 'Evento Jornada — preservar para extração')
) as t(term, replacement, description)
cross join lateral (select id from public.profiles order by created_at limit 1) p
on conflict (term) do nothing;
