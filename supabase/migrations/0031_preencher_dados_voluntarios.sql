-- supabase/migrations/0031_preencher_dados_voluntarios.sql
-- Fill in volunteer data from the institutional roster list.
-- Uses UPDATE for existing volunteers (matched by nome) and INSERT for new ones.
-- Phone numbers are stored as-is; org_depto/funcao/data_inicio are set where
-- the column is currently null (to avoid overwriting manual edits).

-- Helper: normalise phone — keep only digits, + and spaces for international.
-- For WhatsApp links we strip non-digits at display time.

-- =========================================================================
-- 1. UPDATE existing volunteers (match by nome, set telefone + fill nulls)
-- =========================================================================

-- Alexandre de Padua
update public.voluntarios set
  telefone_1 = '(13) 98113-4655',
  telefone_2 = '(13) 98433-3210',
  funcao = coalesce(funcao, 'Monitoria DIP SP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2023-05-03'::date)
where nome ilike 'Alexandre de Padua' and ativo = true;

-- Almir Pereira
update public.voluntarios set
  telefone_1 = '(11) 97111-4573',
  telefone_2 = '11-99627-9518',
  funcao = coalesce(funcao, 'Financeiro'),
  org_depto = coalesce(org_depto, 'Adminstrativo Financeiro'),
  data_inicio = coalesce(data_inicio, '2020-05-22'::date)
where nome ilike 'Almir Pereira' and ativo = true;

-- Ana Prado
update public.voluntarios set
  telefone_1 = '+5541998852257',
  telefone_2 = '(45) 99106-5051',
  funcao = coalesce(funcao, 'Coordenação Parapedagogia'),
  org_depto = coalesce(org_depto, 'Parapedagógico'),
  data_inicio = coalesce(data_inicio, '2025-04-15'::date)
where nome ilike 'Ana Prado' and ativo = true;

-- Ana Yogan
update public.voluntarios set
  telefone_1 = '+1 (561) 414-0229',
  telefone_2 = null,
  funcao = coalesce(funcao, 'Voluntária Internacional'),
  org_depto = coalesce(org_depto, 'Internacional'),
  data_inicio = coalesce(data_inicio, '2024-03-24'::date)
where nome ilike 'Ana Yogan' and ativo = true;

-- Andre Pedretti
update public.voluntarios set
  telefone_1 = '+55 41995382020',
  telefone_2 = '+55 41995382020',
  funcao = coalesce(funcao, 'Financeiro e DIP Foz'),
  org_depto = coalesce(org_depto, 'Adminstrativo Financeiro'),
  data_inicio = coalesce(data_inicio, '2025-01-13'::date)
where nome ilike 'Andre Pedretti' and ativo = true;

-- Angela Mattia
update public.voluntarios set
  telefone_1 = '(00) 00000-0000',
  telefone_2 = null,
  funcao = coalesce(funcao, 'Internacional - DIP'),
  org_depto = coalesce(org_depto, 'Internacional'),
  data_inicio = coalesce(data_inicio, '2025-12-19'::date)
where nome ilike 'Angela Mattia' and ativo = true;

-- Antonio Magalhães
update public.voluntarios set
  telefone_1 = '(45) 99112-2800',
  telefone_2 = '(45) 99112-2882',
  funcao = coalesce(funcao, 'INFRAESTRUTURA - 2025 Projeto'),
  org_depto = coalesce(org_depto, 'Voluntariado'),
  data_inicio = coalesce(data_inicio, '2022-12-19'::date)
where nome ilike 'Antonio Magalhaes' and ativo = true;

-- Aparecida Polastre Fonseca
update public.voluntarios set
  telefone_1 = '(45) 99942-9233',
  telefone_2 = '(45) 99122-9592',
  funcao = coalesce(funcao, 'Monitoria DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2024-07-01'::date)
where nome ilike '%Polastre%' and ativo = true;

-- Bruno Rafael Gris
update public.voluntarios set
  telefone_1 = '(45) 99933-1478',
  telefone_2 = '(45) 99119-4148',
  funcao = coalesce(funcao, 'Financeiro'),
  org_depto = coalesce(org_depto, 'Adminstrativo Financeiro'),
  data_inicio = coalesce(data_inicio, '2023-02-20'::date)
where nome ilike 'Bruno Rafael Gris' and ativo = true;

-- Camila Lass
update public.voluntarios set
  telefone_1 = '(41) 99971-2681',
  telefone_2 = '(41) 99997-3577',
  funcao = coalesce(funcao, 'Monitoria DIP Curitiba'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2023-09-04'::date)
where nome ilike 'Camila Lass' and ativo = true;

-- Carlos Cardoso
update public.voluntarios set
  telefone_1 = null,
  telefone_2 = '(49) 15191-7583',
  funcao = coalesce(funcao, 'Internacional - DIP'),
  org_depto = coalesce(org_depto, 'Internacional'),
  data_inicio = coalesce(data_inicio, '2025-12-19'::date)
where nome ilike 'Carlos Cardoso' and ativo = true;

-- Celeste Silveira
update public.voluntarios set
  telefone_1 = '(61) 99223-7959',
  telefone_2 = '(61) 3347-4979',
  funcao = coalesce(funcao, 'Voluntário'),
  org_depto = coalesce(org_depto, 'Parapedagógico'),
  data_inicio = coalesce(data_inicio, '2016-07-01'::date)
where nome ilike 'Celeste Silveira' and ativo = true;

-- Christian Andrade
update public.voluntarios set
  telefone_1 = '(41) 3206-5559',
  telefone_2 = '(41) 99824-5896',
  funcao = coalesce(funcao, 'Monitoria DIP e Comunicação'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2023-02-27'::date)
where nome ilike 'Christian Andrade' and ativo = true;

-- Claudia Adele Cardoso
update public.voluntarios set
  telefone_1 = '(11) 98585-8875',
  telefone_2 = '(11) 97513-5400',
  funcao = coalesce(funcao, 'Monitoria DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2025-07-11'::date)
where nome ilike 'Claudia Adele Cardoso' and ativo = true;

-- Dalvan Brum
update public.voluntarios set
  telefone_1 = '51982769241',
  telefone_2 = '+55 51 8276-9241',
  funcao = coalesce(funcao, 'Administrativo Parapedagógico e Monitor DIP-RS'),
  org_depto = coalesce(org_depto, 'Parapedagógico'),
  data_inicio = coalesce(data_inicio, '2026-07-29'::date)
where nome ilike 'Dalvan Brum' and ativo = true;

-- Daniel Fernandes Pires
update public.voluntarios set
  telefone_1 = '(13) 99201-9242',
  telefone_2 = '(13) 99183-3868',
  funcao = coalesce(funcao, 'Equipe de Comunicação'),
  org_depto = coalesce(org_depto, 'Comunicação e Eventos'),
  data_inicio = coalesce(data_inicio, '2025-04-15'::date)
where nome ilike 'Daniel Fernandes Pires' and ativo = true;

-- Derick Milan
update public.voluntarios set
  telefone_1 = '(11) 99598-2323',
  telefone_2 = '(11) 98811-5094',
  funcao = coalesce(funcao, 'Monitoria DIP SP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2024-07-17'::date)
where nome ilike 'Derick Milan' and ativo = true;

-- Diogo Pupin Duarte
update public.voluntarios set
  telefone_1 = '01785804985',
  telefone_2 = '49(0)178 919 8785',
  funcao = coalesce(funcao, 'Internacional - DIP'),
  org_depto = coalesce(org_depto, 'Internacional'),
  data_inicio = coalesce(data_inicio, '2025-07-06'::date)
where nome ilike 'Diogo Pupin Duarte' and ativo = true;

-- Eduardo Azevedo
update public.voluntarios set
  telefone_1 = '(45) 99104-1011',
  telefone_2 = '(45) 98824-6868',
  funcao = coalesce(funcao, 'Monitoria DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2025-01-22'::date)
where nome ilike 'Eduardo Azevedo' and ativo = true;

-- Eduardo Doria
update public.voluntarios set
  telefone_1 = '(41) 98739-7378',
  telefone_2 = '(41) 99105-0980',
  funcao = coalesce(funcao, 'Monitoria DIP'),
  org_depto = coalesce(org_depto, 'ECTOLAB'),
  data_inicio = coalesce(data_inicio, '2022-08-13'::date)
where nome ilike 'Eduardo Doria' and ativo = true;

-- Eduardo Vicenzi
update public.voluntarios set
  telefone_1 = '(41) 3209-8986',
  telefone_2 = '+49 17650991354',
  funcao = coalesce(funcao, 'Internacional - DIP - EPICON'),
  org_depto = coalesce(org_depto, 'Internacional'),
  data_inicio = coalesce(data_inicio, '2025-12-19'::date)
where nome ilike 'Eduardo Vicenzi' and ativo = true;

-- Eliana Francilio
update public.voluntarios set
  telefone_1 = '(53) 99911-7065',
  telefone_2 = null,
  funcao = coalesce(funcao, 'Atividades do voluntariado'),
  org_depto = coalesce(org_depto, 'Voluntariado'),
  data_inicio = coalesce(data_inicio, '2026-04-09'::date)
where nome ilike 'Eliana Francilio' and ativo = true;

-- Eliane Amarante
update public.voluntarios set
  telefone_1 = '(45) 99954-8285',
  telefone_2 = '(45) 99904-9757',
  funcao = coalesce(funcao, 'Coordenadora Com. e Eventos'),
  org_depto = coalesce(org_depto, 'Comunicação e Eventos'),
  data_inicio = coalesce(data_inicio, '2025-04-15'::date)
where nome ilike 'Eliane Amarante' and ativo = true;

-- Eliane Cardoso
update public.voluntarios set
  telefone_1 = '(22) 98837-2772',
  telefone_2 = '(14) 99161-5101',
  funcao = coalesce(funcao, 'Monitora DIP RJ'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2018-08-16'::date)
where nome ilike 'Eliane Cardoso' and ativo = true;

-- Érica de Carvalho Monteiro
update public.voluntarios set
  telefone_1 = '(45) 99918-1234',
  telefone_2 = '(31) 99958-1930',
  funcao = coalesce(funcao, 'Indefinida'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2023-03-06'::date)
where nome ilike '%rica de Carvalho Monteiro' and ativo = true;

-- Estela Leal
update public.voluntarios set
  telefone_1 = '(62) 98118-9068',
  telefone_2 = '(62) 98101-9191',
  funcao = coalesce(funcao, 'Docência OGB e DIP Brasília'),
  org_depto = coalesce(org_depto, 'Parapedagógico'),
  data_inicio = coalesce(data_inicio, '2022-05-16'::date)
where nome ilike 'Estela Leal' and ativo = true;

-- Fabi Pereira
update public.voluntarios set
  telefone_1 = '(85) 98888-5494',
  telefone_2 = '(85) 98888-5494',
  funcao = coalesce(funcao, 'Comunicação'),
  org_depto = coalesce(org_depto, 'Comunicação e Eventos'),
  data_inicio = coalesce(data_inicio, '2022-05-10'::date)
where nome ilike 'Fabi Pereira' and ativo = true;

-- Fabiana Cerato
update public.voluntarios set
  telefone_1 = '(45) 99977-4282',
  telefone_2 = null,
  funcao = coalesce(funcao, 'ARQUITETURA'),
  org_depto = coalesce(org_depto, 'Voluntariado'),
  data_inicio = coalesce(data_inicio, '2022-10-26'::date)
where nome ilike 'Fabiana Cerato' and ativo = true;

-- Fátima Fernandes
update public.voluntarios set
  telefone_1 = '45991152143',
  telefone_2 = null,
  funcao = coalesce(funcao, 'voluntário de projeto - Livro'),
  org_depto = coalesce(org_depto, 'ECTOLAB'),
  data_inicio = coalesce(data_inicio, '2024-08-20'::date)
where nome ilike '%atima Fernandes' and ativo = true;

-- Fernanda Saad
update public.voluntarios set
  telefone_1 = '(41) 99769-7490',
  telefone_2 = '(41) 99903-4066',
  funcao = coalesce(funcao, 'Monitoria DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2024-11-13'::date)
where nome ilike 'Fernanda Saad' and ativo = true;

-- Flávia Rogick
update public.voluntarios set
  telefone_1 = '(45) 9919-6637',
  telefone_2 = null,
  funcao = coalesce(funcao, 'voluntária'),
  org_depto = coalesce(org_depto, 'Parapedagógico'),
  data_inicio = coalesce(data_inicio, '2025-06-16'::date)
where nome ilike 'Fl%via Rogick' and ativo = true;

-- Francisco Ávila
update public.voluntarios set
  telefone_1 = '(+351 91) 8452-388',
  telefone_2 = '00351 918186450',
  funcao = coalesce(funcao, 'Coordenador Intercooperação Internacional'),
  org_depto = coalesce(org_depto, 'Internacional'),
  data_inicio = coalesce(data_inicio, '2025-04-15'::date)
where nome ilike 'Francisco %vila' and ativo = true;

-- Giuliano Ginani
update public.voluntarios set
  telefone_1 = '(54) 99148-9653',
  telefone_2 = '(45) 99919-1833',
  funcao = coalesce(funcao, 'Laboratório de Ectoplasmia'),
  org_depto = coalesce(org_depto, 'Paratecnológico'),
  data_inicio = coalesce(data_inicio, '2025-02-26'::date)
where nome ilike 'Giuliano Ginani' and ativo = true;

-- Goretti Lopes
update public.voluntarios set
  telefone_1 = '(55) 22998-5137',
  telefone_2 = null,
  funcao = coalesce(funcao, 'DIP RJ'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2018-02-11'::date)
where nome ilike 'Goretti Lopes' and ativo = true;

-- Graziele Cunha
update public.voluntarios set
  telefone_1 = '(41) 98496-4959',
  telefone_2 = '(41) 99871-6839',
  funcao = coalesce(funcao, 'Monitoria DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2024-08-14'::date)
where nome ilike 'Graziele Cunha' and ativo = true;

-- Hercilio Lau
update public.voluntarios set
  telefone_1 = '(22) 99884-5087',
  telefone_2 = '(22) 99884-5087',
  funcao = coalesce(funcao, 'Monitoria DIP RJ'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2018-02-02'::date)
where nome ilike 'Hercilio Lau' and ativo = true;

-- Hernande Leite
update public.voluntarios set
  telefone_1 = '(45) 99999-3553',
  telefone_2 = null,
  funcao = coalesce(funcao, 'Parapedagógico'),
  org_depto = coalesce(org_depto, 'Parapedagógico'),
  data_inicio = coalesce(data_inicio, '2025-07-24'::date)
where nome ilike 'Hernande Leite' and ativo = true;

-- Ismael Pinheiro Junior
update public.voluntarios set
  telefone_1 = '62994223000',
  telefone_2 = '(62) 99528-0613',
  funcao = coalesce(funcao, 'Tecnico científico - Pesquisa'),
  org_depto = coalesce(org_depto, 'ECTOLAB'),
  data_inicio = coalesce(data_inicio, '2013-05-01'::date)
where nome ilike 'Ismael Pinheiro%' and ativo = true;

-- Janete Rousselet de Souza
update public.voluntarios set
  telefone_1 = '(51) 3785-6098',
  telefone_2 = '(51) 98179-2014',
  funcao = coalesce(funcao, 'equipe voluntariado'),
  org_depto = coalesce(org_depto, 'Voluntariado'),
  data_inicio = coalesce(data_inicio, '2025-04-15'::date)
where nome ilike 'Janete Rousselet%' and ativo = true;

-- Jaqueline Barcellos
update public.voluntarios set
  telefone_1 = '61996979365',
  telefone_2 = '(61) 99206-0406',
  funcao = coalesce(funcao, 'Parapedagógico'),
  org_depto = coalesce(org_depto, 'Parapedagógico'),
  data_inicio = coalesce(data_inicio, '2024-12-04'::date)
where nome ilike 'Jaqueline Barcellos' and ativo = true;

-- João Alberto de Oliveira
update public.voluntarios set
  telefone_1 = '(55) 43999-7334',
  telefone_2 = '(43) 99974-5130',
  funcao = coalesce(funcao, 'voluntario por projeto - dodecaédro'),
  org_depto = coalesce(org_depto, 'Voluntariado'),
  data_inicio = coalesce(data_inicio, '2023-05-02'::date)
where nome ilike 'Jo%Eo Alberto de Oliveira' and ativo = true;

-- Jonathan Bretas
update public.voluntarios set
  telefone_1 = '45991535300',
  telefone_2 = '21-97508-3922',
  funcao = coalesce(funcao, 'Coordenação Geral'),
  org_depto = coalesce(org_depto, 'Coordenação geral'),
  data_inicio = coalesce(data_inicio, '2025-04-15'::date)
where nome ilike 'Jonathan Bretas' and ativo = true;

-- Jorge Washington de Camargo
update public.voluntarios set
  telefone_1 = '(45) 99804-6548',
  telefone_2 = '(45) 99830-6284',
  funcao = coalesce(funcao, 'Monit. DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2024-07-07'::date)
where nome ilike 'Jorge Washington%' and ativo = true;

-- Jose Luis Ara Sobrinho
update public.voluntarios set
  telefone_1 = '(41) 99235-8502',
  telefone_2 = '41 9235-8502',
  funcao = coalesce(funcao, 'COORDENAÇÃO CURITIBA'),
  org_depto = coalesce(org_depto, 'ECTOLAB'),
  data_inicio = coalesce(data_inicio, '2025-06-19'::date)
where nome ilike 'Jose Luis Ara%' and ativo = true;

-- Juliana de Souza Medeiros
update public.voluntarios set
  telefone_1 = '(45) 99155-0711',
  telefone_2 = '(45) 99907-0111',
  funcao = coalesce(funcao, 'Monitoria DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2023-10-04'::date)
where nome ilike 'Juliana de Souza Medeiros' and ativo = true;

-- Keity Naira Girardi
update public.voluntarios set
  telefone_1 = '(47) 99973-1991',
  telefone_2 = '(47) 3382-6217',
  funcao = coalesce(funcao, 'sem informação'),
  org_depto = coalesce(org_depto, 'ECTOLAB'),
  data_inicio = coalesce(data_inicio, '2019-07-31'::date)
where nome ilike 'Keity Naira Girardi' and ativo = true;

-- Leonardo Paludeto
update public.voluntarios set
  telefone_1 = '(45) 99151-2530',
  telefone_2 = '(45) 99151-2530',
  funcao = coalesce(funcao, 'Voluntário projeto'),
  org_depto = coalesce(org_depto, 'Paratecnológico'),
  data_inicio = coalesce(data_inicio, '2024-10-20'::date)
where nome ilike 'Leonardo Paludeto' and ativo = true;

-- Leopoldo de Macedo
update public.voluntarios set
  telefone_1 = '(41) 99927-7789',
  telefone_2 = '(41) 98726-0159',
  funcao = coalesce(funcao, 'Monitoria DIP Curitiba e Comunicação'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2024-12-18'::date)
where nome ilike 'Leopoldo de Macedo' and ativo = true;

-- Lidia Bolfe
update public.voluntarios set
  telefone_1 = '(41) 99172-0490',
  telefone_2 = null,
  funcao = coalesce(funcao, 'Coordenação Bioenergologia'),
  org_depto = coalesce(org_depto, 'Bioenergologia'),
  data_inicio = coalesce(data_inicio, '2025-04-15'::date)
where nome ilike 'Lidia Bolfe' and ativo = true;

-- Lucas Rinaldi
update public.voluntarios set
  telefone_1 = '(11) 99599-4585',
  telefone_2 = '(11) 98414-0491',
  funcao = coalesce(funcao, 'Coord. geral'),
  org_depto = coalesce(org_depto, 'Coordenação geral'),
  data_inicio = coalesce(data_inicio, '2020-04-10'::date)
where nome ilike 'Lucas Rinaldi' and ativo = true;

-- Luciano Guerini
update public.voluntarios set
  telefone_1 = '41998322858',
  telefone_2 = null,
  funcao = coalesce(funcao, 'Coordenação DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2017-04-08'::date)
where nome ilike 'Luciano Guerini' and ativo = true;

-- Luiz Antonio Rezende Lima
update public.voluntarios set
  telefone_1 = '(31) 99239-1269',
  telefone_2 = null,
  funcao = coalesce(funcao, 'Monitor DIP FOZ'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2026-07-10'::date)
where nome ilike 'Luiz Antonio Rezende%' and ativo = true;

-- Luiz Claudio Pereira Costa
update public.voluntarios set
  telefone_1 = '(61) 99826-1112',
  telefone_2 = '(61) 3448-6404',
  funcao = coalesce(funcao, 'Administrativo do Parapedagógico e Monitor DIP-BR'),
  org_depto = coalesce(org_depto, 'Parapedagógico'),
  data_inicio = coalesce(data_inicio, '2026-07-30'::date)
where nome ilike 'Luiz Claudio%' and ativo = true;

-- Manoela Bittencourt
update public.voluntarios set
  telefone_1 = '+491789198785',
  telefone_2 = '49 178 5804985',
  funcao = coalesce(funcao, 'Internacional - DIP'),
  org_depto = coalesce(org_depto, 'Internacional'),
  data_inicio = coalesce(data_inicio, '2025-07-06'::date)
where nome ilike 'Manoela Bittencourt' and ativo = true;

-- Marcello Paskulin
update public.voluntarios set
  telefone_1 = '(45) 99912-2901',
  telefone_2 = '(45) 99157-7128',
  funcao = coalesce(funcao, 'Monitoria DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2024-07-01'::date)
where nome ilike 'Marcello Paskulin' and ativo = true;

-- Marcelo Silva
update public.voluntarios set
  telefone_1 = '(45) 99991-6997',
  telefone_2 = '(45) 99920-8701',
  funcao = coalesce(funcao, 'Epicon + Projeto acadêmico/pesquisa'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2019-01-01'::date)
where nome ilike 'Marcelo Silva' and ativo = true;

-- Marcia Toledo
update public.voluntarios set
  telefone_1 = '(48) 98411-8444',
  telefone_2 = '(48) 98404-9194',
  funcao = coalesce(funcao, 'Voluntária DIP Florianópolis'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2015-10-10'::date)
where nome ilike 'Marcia Toledo' and ativo = true;

-- Marcos Ulaf
update public.voluntarios set
  telefone_1 = '(41) 99615-0929',
  telefone_2 = '41-99824-8009',
  funcao = coalesce(funcao, 'Monitoria DIP e Jurídico'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2018-02-01'::date)
where nome ilike 'Marcos Ulaf' and ativo = true;

-- Maria de Lourdes Pekin-maludy
update public.voluntarios set
  telefone_1 = '(45) 99151-5145',
  telefone_2 = '(45) 99151-1950',
  funcao = coalesce(funcao, 'Voluntária DIP Foz'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2024-04-22'::date)
where nome ilike 'Maria de Lourdes%' and ativo = true;

-- Maria Gabriela
update public.voluntarios set
  telefone_1 = '(45) 99133-1478',
  telefone_2 = '(45) 99119-4148',
  funcao = coalesce(funcao, 'Financeiro'),
  org_depto = coalesce(org_depto, 'Adminstrativo Financeiro'),
  data_inicio = coalesce(data_inicio, '2023-11-29'::date)
where nome ilike 'Maria Gabriela' and ativo = true;

-- Maria Marques
update public.voluntarios set
  telefone_1 = '11998298519',
  telefone_2 = null,
  funcao = coalesce(funcao, 'Monitoria DIP SP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2016-03-14'::date)
where nome ilike 'Maria Marques' and ativo = true;

-- Maria Silvia
update public.voluntarios set
  telefone_1 = '(19) 99769-6922',
  telefone_2 = null,
  funcao = coalesce(funcao, 'Financeiro'),
  org_depto = coalesce(org_depto, 'Adminstrativo Financeiro'),
  data_inicio = coalesce(data_inicio, '2024-03-28'::date)
where nome ilike 'Maria Silvia' and ativo = true;

-- Maria Teixeira
update public.voluntarios set
  telefone_1 = '(11) 97626-3362',
  telefone_2 = '(11) 96925-5595',
  funcao = coalesce(funcao, 'Equipe Voluntariado e DIP SP'),
  org_depto = coalesce(org_depto, 'Voluntariado'),
  data_inicio = coalesce(data_inicio, '2025-09-03'::date)
where nome ilike 'Maria Teixeira' and ativo = true;

-- Mariana Cabral
update public.voluntarios set
  telefone_1 = '(11) 98219-8674',
  telefone_2 = '(11) 98722-2183',
  funcao = coalesce(funcao, 'pesquisa'),
  org_depto = coalesce(org_depto, 'Paratecnológico'),
  data_inicio = coalesce(data_inicio, '2015-05-01'::date)
where nome ilike 'Mariana Cabral' and ativo = true;

-- Maricy Teixeira
update public.voluntarios set
  telefone_1 = '+55 11976263362',
  telefone_2 = '+55 11976263362',
  funcao = coalesce(funcao, 'Voluntariado'),
  org_depto = coalesce(org_depto, 'Voluntariado'),
  data_inicio = coalesce(data_inicio, '2025-10-13'::date)
where nome ilike 'Maricy Teixeira' and ativo = true;

-- Máris Polo Paz
update public.voluntarios set
  telefone_1 = '(11) 99627-9518',
  telefone_2 = '(11) 99711-4573',
  funcao = coalesce(funcao, 'Coordenadora DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2025-04-15'::date)
where nome ilike '%ris Polo Paz' and ativo = true;

-- Marlise Royer
update public.voluntarios set
  telefone_1 = '(61) 98148-0095',
  telefone_2 = '(45) 9993',
  funcao = coalesce(funcao, 'Monitoria DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2024-07-08'::date)
where nome ilike 'Marlise Royer' and ativo = true;

-- Mauro Buerger
update public.voluntarios set
  telefone_1 = '(47) 99136-1616',
  telefone_2 = '(47) 99196-7778',
  funcao = coalesce(funcao, 'Monitor DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2019-06-01'::date)
where nome ilike 'Mauro Buerger' and ativo = true;

-- Mauro Ferreira
update public.voluntarios set
  telefone_1 = '(11) 99512-2966',
  telefone_2 = '(11) 99664-2195',
  funcao = coalesce(funcao, 'Monitoria DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2024-07-15'::date)
where nome ilike 'Mauro Ferreira' and ativo = true;

-- Mauro Oliveira
update public.voluntarios set
  telefone_1 = '11985223414',
  telefone_2 = '(11) 98522-3414',
  funcao = coalesce(funcao, 'Monitoria DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2025-07-01'::date)
where nome ilike 'Mauro Oliveira' and ativo = true;

-- Miryan Akemi Ishikawa
update public.voluntarios set
  telefone_1 = '(11) 99186-5054',
  telefone_2 = '(11) 97173-8900',
  funcao = coalesce(funcao, 'Coordenação ECTOLAB SP'),
  org_depto = coalesce(org_depto, 'Coordenação geral'),
  data_inicio = coalesce(data_inicio, '2019-09-06'::date)
where nome ilike 'Miryan Akemi%' and ativo = true;

-- Munir Bazzi
update public.voluntarios set
  telefone_1 = '(41) 99902-9648',
  telefone_2 = '(41) 99193-6866',
  funcao = coalesce(funcao, 'Monitoria DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2024-09-27'::date)
where nome ilike 'Munir Bazzi' and ativo = true;

-- Myriam Sanchez
update public.voluntarios set
  telefone_1 = '(45) 99915-3553',
  telefone_2 = '(45) 99999-3553',
  funcao = coalesce(funcao, 'Coordenação Geral'),
  org_depto = coalesce(org_depto, 'Coordenação geral'),
  data_inicio = coalesce(data_inicio, '2025-04-15'::date)
where nome ilike 'Myriam Sanchez' and ativo = true;

-- Natalia Amendola
update public.voluntarios set
  telefone_1 = '(45) 98409-2536',
  telefone_2 = '45-98402-4847',
  funcao = coalesce(funcao, 'Voluntaria projeto'),
  org_depto = coalesce(org_depto, 'Paratecnológico'),
  data_inicio = coalesce(data_inicio, '2024-12-09'::date)
where nome ilike 'Natalia Amendola' and ativo = true;

-- Nelson Figueiredo Junior
update public.voluntarios set
  telefone_1 = '(48) 99810-4119',
  telefone_2 = '48-99978-0773',
  funcao = coalesce(funcao, 'Monitoria DIP FLORIPA'),
  org_depto = coalesce(org_depto, 'Paratecnológico'),
  data_inicio = coalesce(data_inicio, '2024-09-09'::date)
where nome ilike 'Nelson Figueiredo%' and ativo = true;

-- Patrícia Carneiro
update public.voluntarios set
  telefone_1 = '351 91845 2388',
  telefone_2 = '351 91900 0351',
  funcao = coalesce(funcao, 'Intercooperação Internacional'),
  org_depto = coalesce(org_depto, 'Internacional'),
  data_inicio = coalesce(data_inicio, '2024-11-27'::date)
where nome ilike 'Patr%cia Carneiro' and ativo = true;

-- Paula Nogara
update public.voluntarios set
  telefone_1 = '(42) 98833-8815',
  telefone_2 = '(42) 98815-9158',
  funcao = coalesce(funcao, 'Voluntária pesquisa'),
  org_depto = coalesce(org_depto, 'ECTOLAB'),
  data_inicio = coalesce(data_inicio, '2016-03-01'::date)
where nome ilike 'Paula Nogara' and ativo = true;

-- Paulo Battistella
update public.voluntarios set
  telefone_1 = '48996038022',
  telefone_2 = null,
  funcao = coalesce(funcao, 'Parapedagógico'),
  org_depto = coalesce(org_depto, 'Parapedagógico'),
  data_inicio = coalesce(data_inicio, '2025-04-15'::date)
where nome ilike 'Paulo Battistella' and ativo = true;

-- Paulo Franco
update public.voluntarios set
  telefone_1 = '(41) 99982-2126',
  telefone_2 = '41-99685-3596',
  funcao = coalesce(funcao, 'DIP E FINANCEIRO'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2018-02-01'::date)
where nome ilike 'Paulo Franco' and ativo = true;

-- Rafael Pereira
update public.voluntarios set
  telefone_1 = '(11) 96578-1661',
  telefone_2 = '(11) 96578-1661',
  funcao = coalesce(funcao, 'Monitoria DIP SÃO PAULO'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2025-06-08'::date)
where nome ilike 'Rafael Pereira' and ativo = true;

-- Regina Krupka
update public.voluntarios set
  telefone_1 = '(11) 99936-6888',
  telefone_2 = '(11) 99687-4479',
  funcao = coalesce(funcao, 'Coord Geral Voluntariado e Coord. DIP São Paulo'),
  org_depto = coalesce(org_depto, 'Voluntariado'),
  data_inicio = coalesce(data_inicio, '2025-04-15'::date)
where nome ilike 'Regina Krupka' and ativo = true;

-- Rinaldo Nishimura
update public.voluntarios set
  telefone_1 = '(45) 99133-6227',
  telefone_2 = '(45) 99133-7963',
  funcao = coalesce(funcao, 'Coordenador Financeiro e DIP'),
  org_depto = coalesce(org_depto, 'Adminstrativo Financeiro'),
  data_inicio = coalesce(data_inicio, '2025-04-15'::date)
where nome ilike 'Rinaldo Nishimura' and ativo = true;

-- Rosangela Medeiros
update public.voluntarios set
  telefone_1 = '(45) 99121-1330',
  telefone_2 = '(45) 99121-1330',
  funcao = coalesce(funcao, 'Bioenergologia'),
  org_depto = coalesce(org_depto, 'Bioenergologia'),
  data_inicio = coalesce(data_inicio, '2022-09-14'::date)
where nome ilike 'Rosangela Medeiros' and ativo = true;

-- Sonia Souza
update public.voluntarios set
  telefone_1 = '(11) 97251-8144',
  telefone_2 = '(11) 99779-8714',
  funcao = coalesce(funcao, 'Voluntário DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2014-02-10'::date)
where nome ilike 'Sonia Souza' and ativo = true;

-- Sonya Maria Ruiz
update public.voluntarios set
  telefone_1 = '(85) 98672-9119',
  telefone_2 = '(85) 98672-9119',
  funcao = coalesce(funcao, 'Parapedagógico'),
  org_depto = coalesce(org_depto, 'Voluntariado'),
  data_inicio = coalesce(data_inicio, '2022-02-22'::date)
where nome ilike 'Sonya Maria Ruiz' and ativo = true;

-- Tania Mendes
update public.voluntarios set
  telefone_1 = '(22) 99900-3091',
  telefone_2 = '(22) 99996-1844',
  funcao = coalesce(funcao, 'Monitoria DIP RJ'),
  org_depto = coalesce(org_depto, 'Adminstrativo Financeiro'),
  data_inicio = coalesce(data_inicio, '2024-07-24'::date)
where nome ilike 'Tania Mendes' and ativo = true;

-- Thiago Pontes
update public.voluntarios set
  telefone_1 = '(41) 9990-1406',
  telefone_2 = '(41) 99901-4068',
  funcao = coalesce(funcao, 'Monitoria DIP'),
  org_depto = coalesce(org_depto, 'Voluntariado'),
  data_inicio = coalesce(data_inicio, '2022-07-11'::date)
where nome ilike 'Thiago Pontes' and ativo = true;

-- Thiago Ribeiro
update public.voluntarios set
  telefone_1 = '69-99961-4259',
  telefone_2 = '(19) 98422-5050',
  funcao = coalesce(funcao, 'Comunicação'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2025-03-07'::date)
where nome ilike 'Thiago Ribeiro' and ativo = true;

-- Vânia Cabral
update public.voluntarios set
  telefone_1 = '(91) 91977-7350',
  telefone_2 = '(11) 96578-1661',
  funcao = coalesce(funcao, 'Monitoria DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2025-06-08'::date)
where nome ilike 'V%nia Cabral' and ativo = true;

-- Viviane Aparecida de Sousa
update public.voluntarios set
  telefone_1 = '(11) 98414-0491',
  telefone_2 = null,
  funcao = coalesce(funcao, 'DIP'),
  org_depto = coalesce(org_depto, 'DIP'),
  data_inicio = coalesce(data_inicio, '2022-10-17'::date)
where nome ilike 'Viviane Aparecida%' and ativo = true;
