// One-off, never-deployed script. Lives outside src/ and must never be
// imported by a page, route, component, or Server Action — it holds the
// service-role key, which bypasses every RLS policy. Run locally with:
//   npm run seed:voluntarios
// Seeds the INSTITUTIONAL ROSTER (public.voluntarios, migration 0017) with
// the real volunteer list provided by the institution (2026-08-04): nome,
// código PF, unidade, org depto, função, data de início, observações, área
// e papel/funções pretendidos (role/areas_lideradas are applied to the
// linked account at self-link time — migration 0017's
// vincular_meu_cadastro()).
//
// No auth accounts are created here: volunteers are registered in the
// system BEFORE they have access. When a volunteer signs up with their
// institutional e-mail, the /vincular flow lets them pick their name in
// this roster and link the account.
import { createClient } from "@supabase/supabase-js";

type Papel =
  | "coordenador_geral"
  | "coordenador_area"
  | "voluntario_comum"
  | "financeiro"
  | "voluntariado";

type Voluntario = {
  nome: string;
  codigo_pf: string;
  unidade: string | null;
  org_depto: string | null;
  funcao: string | null;
  data_inicio: string | null; // ISO yyyy-MM-dd
  obs: string | null;
  area: string | null;
  role: Papel | null;
  areas_lideradas: string[];
};

// Areas canônicas derivadas das colunas "Org Depto"/"Função" da planilha.
const AREA_FINANCEIRO = "Financeiro";
const AREA_VOLUNTARIADO = "Voluntariado";
const AREA_COMUNICACAO = "Comunicação e Eventos";
const AREA_PARAPEDAGOGICO = "Parapedagógico";
const AREA_DIP = "Paratecnológico - DIP";
const AREA_BIOENERGOLOGIA = "Paratecnológico - Bioenergologia";
const AREA_PARATECNOLOGICO = "Paratecnológico";
const AREA_INTERNACIONAL = "Internacional";
const AREA_COORD_GERAL = "Coordenação Geral";
const AREA_PESQUISA = "Pesquisa";

const ORG_FINANCEIRO = "ECTOLAB \\ Adminstrativo Financeiro";
const ORG_VOLUNTARIADO = "ECTOLAB \\ Voluntariado";
const ORG_COMUNICACAO = "ECTOLAB \\ Comunicação e Eventos";
const ORG_PARAPEDAGOGICO = "ECTOLAB \\ Parapedagógico";
const ORG_DIP = "ECTOLAB \\ Paratecnológico \\ DIP";
const ORG_BIOENERGOLOGIA = "ECTOLAB \\ Paratecnológico \\ Bioenergologia";
const ORG_PARATECNOLOGICO = "ECTOLAB \\ Paratecnológico";
const ORG_INTERNACIONAL = "ECTOLAB \\ Internacional";
const ORG_COORD_GERAL = "ECTOLAB \\ Coordenação Geral";
const ORG_ECTOLAB = "ECTOLAB";

const VOLUNTEERS: Voluntario[] = [
  { nome: "Alexandre de Padua", codigo_pf: "505418", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP SP", data_inicio: "2023-05-03", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Almir Pereira", codigo_pf: "133680", unidade: "ECTOLAB", org_depto: ORG_FINANCEIRO, funcao: "Financeiro", data_inicio: "2020-05-22", obs: "Operador de StreamYard", area: AREA_FINANCEIRO, role: "financeiro", areas_lideradas: [] },
  { nome: "Ana Prado", codigo_pf: "137062", unidade: "ECTOLAB", org_depto: ORG_PARAPEDAGOGICO, funcao: "Coordenação Parapedagogia", data_inicio: "2025-04-15", obs: null, area: AREA_PARAPEDAGOGICO, role: "coordenador_area", areas_lideradas: [AREA_PARAPEDAGOGICO] },
  { nome: "Ana Yogan", codigo_pf: "131351", unidade: "ECTOLAB", org_depto: ORG_INTERNACIONAL, funcao: "Voluntária Internacional", data_inicio: "2024-03-24", obs: null, area: AREA_INTERNACIONAL, role: null, areas_lideradas: [] },
  { nome: "Andre Pedretti", codigo_pf: "503589", unidade: "ECTOLAB", org_depto: ORG_FINANCEIRO, funcao: "Financeiro e DIP Foz", data_inicio: "2025-01-13", obs: null, area: AREA_FINANCEIRO, role: "financeiro", areas_lideradas: [] },
  { nome: "Angela Mattia", codigo_pf: "508397", unidade: "ECTOLAB", org_depto: ORG_INTERNACIONAL, funcao: "Internacional - DIP", data_inicio: "2025-12-19", obs: null, area: AREA_INTERNACIONAL, role: null, areas_lideradas: [] },
  { nome: "Antonio Magalhães", codigo_pf: "131632", unidade: "ECTOLAB", org_depto: ORG_VOLUNTARIADO, funcao: "Infraestrutura - 2025 Projeto", data_inicio: "2022-12-19", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [] },
  { nome: "Aparecida Polastre Fonseca", codigo_pf: "128959", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-07-01", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Bruno Rafael Gris", codigo_pf: "138028", unidade: "ECTOLAB", org_depto: ORG_FINANCEIRO, funcao: null, data_inicio: "2023-02-20", obs: "Em 03/08/2024 solicitou afastamento por 3 meses", area: AREA_FINANCEIRO, role: null, areas_lideradas: [] },
  { nome: "Camila Lass", codigo_pf: "139546", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitoria DIP Curitiba", data_inicio: "2023-09-04", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Carlos Cardoso", codigo_pf: "136486", unidade: "ECTOLAB", org_depto: ORG_INTERNACIONAL, funcao: "Internacional - DIP", data_inicio: "2025-12-19", obs: null, area: AREA_INTERNACIONAL, role: null, areas_lideradas: [] },
  { nome: "Celeste Silveira", codigo_pf: "129395", unidade: "Brasília", org_depto: ORG_PARAPEDAGOGICO, funcao: "Voluntário", data_inicio: "2016-07-01", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [] },
  { nome: "Christian Andrade", codigo_pf: "132371", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitoria DIP e Comunicação", data_inicio: "2023-02-27", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Claudia Adele Cardoso", codigo_pf: "133726", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2025-07-11", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Dalvan Brum", codigo_pf: "502990", unidade: "ECTOLAB", org_depto: ORG_PARAPEDAGOGICO, funcao: "Administrativo Parapedagógico e Monitor DIP-RS", data_inicio: "2026-07-29", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [] },
  { nome: "Daniel Fernandes Pires", codigo_pf: "508352", unidade: "ECTOLAB", org_depto: ORG_COMUNICACAO, funcao: "Equipe de Comunicação", data_inicio: "2025-04-15", obs: null, area: AREA_COMUNICACAO, role: null, areas_lideradas: [] },
  { nome: "Derick Milan", codigo_pf: "509349", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP SP", data_inicio: "2024-07-17", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Diogo Pupin Duarte", codigo_pf: "133526", unidade: "ECTOLAB", org_depto: ORG_INTERNACIONAL, funcao: "Internacional - DIP", data_inicio: "2025-07-06", obs: null, area: AREA_INTERNACIONAL, role: null, areas_lideradas: [] },
  { nome: "Eduardo Azevedo", codigo_pf: "130943", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2025-01-22", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Eduardo Doria", codigo_pf: "129107", unidade: "Curitiba", org_depto: ORG_ECTOLAB, funcao: "Monitoria DIP", data_inicio: "2022-08-13", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Eduardo Vicenzi", codigo_pf: "128758", unidade: "ECTOLAB", org_depto: ORG_INTERNACIONAL, funcao: "Internacional - DIP - EPICON", data_inicio: "2025-12-19", obs: null, area: AREA_INTERNACIONAL, role: null, areas_lideradas: [] },
  { nome: "Eliana Francilio", codigo_pf: "503007", unidade: "ECTOLAB", org_depto: ORG_VOLUNTARIADO, funcao: "Atividades do voluntariado", data_inicio: "2026-04-09", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [] },
  { nome: "Eliane Amarante", codigo_pf: "130069", unidade: "ECTOLAB", org_depto: ORG_COMUNICACAO, funcao: "Coordenadora Com. e Eventos", data_inicio: "2025-04-15", obs: null, area: AREA_COMUNICACAO, role: "coordenador_area", areas_lideradas: [AREA_COMUNICACAO] },
  { nome: "Eliane Cardoso", codigo_pf: "130160", unidade: "Rio de Janeiro", org_depto: ORG_DIP, funcao: "Monitora DIP RJ", data_inicio: "2018-08-16", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Érica de Carvalho Monteiro", codigo_pf: "129259", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Indefinida", data_inicio: "2023-03-06", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Estela Leal", codigo_pf: "135819", unidade: "Brasília", org_depto: ORG_PARAPEDAGOGICO, funcao: "Docência OGB e DIP Brasília", data_inicio: "2022-05-16", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [] },
  { nome: "Fabi Pereira", codigo_pf: "506511", unidade: "ECTOLAB", org_depto: ORG_COMUNICACAO, funcao: "Comunicação", data_inicio: "2022-05-10", obs: null, area: AREA_COMUNICACAO, role: null, areas_lideradas: [] },
  { nome: "Fabiana Cerato", codigo_pf: "128844", unidade: "ECTOLAB", org_depto: ORG_VOLUNTARIADO, funcao: "Arquitetura", data_inicio: "2022-10-26", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [] },
  { nome: "Fátima Fernandes", codigo_pf: "132967", unidade: "ECTOLAB", org_depto: ORG_ECTOLAB, funcao: "Voluntário de projeto - Livro", data_inicio: "2024-08-20", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [] },
  { nome: "Fernanda Saad", codigo_pf: "511187", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-11-13", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Flávia Rogick", codigo_pf: "129021", unidade: "ECTOLAB", org_depto: ORG_PARAPEDAGOGICO, funcao: "Voluntária", data_inicio: "2025-06-16", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [] },
  { nome: "Francisco Ávila", codigo_pf: "140296", unidade: "Portugal", org_depto: ORG_INTERNACIONAL, funcao: "Coordenador Intercooperação Internacional", data_inicio: "2025-04-15", obs: null, area: AREA_INTERNACIONAL, role: "coordenador_area", areas_lideradas: [AREA_INTERNACIONAL] },
  { nome: "Giuliano Ginani", codigo_pf: "503427", unidade: "ECTOLAB", org_depto: ORG_PARATECNOLOGICO, funcao: "Laboratório de Ectoplasmia", data_inicio: "2025-02-26", obs: null, area: AREA_PARATECNOLOGICO, role: null, areas_lideradas: [] },
  { nome: "Goretti Lopes", codigo_pf: "128816", unidade: "Rio de Janeiro", org_depto: ORG_DIP, funcao: "DIP RJ", data_inicio: "2018-02-11", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Graziele Cunha", codigo_pf: "506704", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-08-14", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Hercilio Lau", codigo_pf: "129014", unidade: "Rio de Janeiro", org_depto: ORG_DIP, funcao: "Monitoria DIP RJ", data_inicio: "2018-02-02", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Hernande Leite", codigo_pf: "129136", unidade: "São Paulo", org_depto: ORG_PARAPEDAGOGICO, funcao: "Parapedagógico", data_inicio: "2025-07-24", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [] },
  { nome: "Ismael Pinheiro Junior", codigo_pf: "135193", unidade: "ECTOLAB", org_depto: ORG_ECTOLAB, funcao: "Técnico científico - Pesquisa", data_inicio: "2013-05-01", obs: null, area: AREA_PESQUISA, role: null, areas_lideradas: [] },
  { nome: "Janete Rousselet de Souza", codigo_pf: "135874", unidade: "ECTOLAB", org_depto: ORG_VOLUNTARIADO, funcao: "Equipe voluntariado", data_inicio: "2025-04-15", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [] },
  { nome: "Jaqueline Barcellos", codigo_pf: "505186", unidade: "Brasília", org_depto: ORG_PARAPEDAGOGICO, funcao: "Parapedagógico", data_inicio: "2024-12-04", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [] },
  { nome: "João Alberto de Oliveira", codigo_pf: "138461", unidade: "ECTOLAB", org_depto: ORG_VOLUNTARIADO, funcao: "Voluntário por projeto - Dodecaedro", data_inicio: "2023-05-02", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [] },
  { nome: "Jonathan Bretas", codigo_pf: "509709", unidade: "ECTOLAB", org_depto: ORG_COORD_GERAL, funcao: "Coordenação Geral", data_inicio: "2025-04-15", obs: null, area: AREA_COORD_GERAL, role: "coordenador_geral", areas_lideradas: [] },
  { nome: "Jorge Washington de Camargo", codigo_pf: "134020", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-07-07", obs: "Afastado p/ 6 meses a partir de 03/09/2025", area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Jose Luis Ara Sobrinho", codigo_pf: "132600", unidade: "Curitiba", org_depto: ORG_ECTOLAB, funcao: "Coordenação Curitiba", data_inicio: "2025-06-19", obs: null, area: AREA_COORD_GERAL, role: "coordenador_area", areas_lideradas: ["Curitiba"] },
  { nome: "Juliana de Souza Medeiros", codigo_pf: "132906", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2023-10-04", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Keity Naira Girardi", codigo_pf: "136444", unidade: "Santa Catarina", org_depto: ORG_ECTOLAB, funcao: null, data_inicio: "2019-07-31", obs: "Sem informação", area: null, role: null, areas_lideradas: [] },
  { nome: "Leonardo Paludeto", codigo_pf: "129143", unidade: "ECTOLAB", org_depto: ORG_PARATECNOLOGICO, funcao: "Voluntário projeto", data_inicio: "2024-10-20", obs: null, area: AREA_PARATECNOLOGICO, role: null, areas_lideradas: [] },
  { nome: "Leopoldo de Macedo", codigo_pf: "510532", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitoria DIP Curitiba e Comunicação", data_inicio: "2024-12-18", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Lidia Bolfe", codigo_pf: "137427", unidade: "ECTOLAB", org_depto: ORG_BIOENERGOLOGIA, funcao: "Coordenação Bioenergologia", data_inicio: "2025-04-15", obs: null, area: AREA_BIOENERGOLOGIA, role: "coordenador_area", areas_lideradas: [AREA_BIOENERGOLOGIA] },
  { nome: "Lucas Rinaldi", codigo_pf: "137813", unidade: "ECTOLAB", org_depto: ORG_COORD_GERAL, funcao: "Coordenação geral", data_inicio: "2020-04-10", obs: "Afastou em 17/04/25 por 6 meses", area: AREA_COORD_GERAL, role: null, areas_lideradas: [] },
  { nome: "Luciano Guerini", codigo_pf: "505482", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Coordenação DIP", data_inicio: "2017-04-08", obs: null, area: AREA_DIP, role: "coordenador_area", areas_lideradas: [AREA_DIP] },
  { nome: "Luiz Antonio Rezende Lima", codigo_pf: "138982", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitor DIP FOZ", data_inicio: "2026-07-10", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Luiz Claudio Pereira Costa", codigo_pf: "135678", unidade: "Brasília", org_depto: ORG_PARAPEDAGOGICO, funcao: "Administrativo do Parapedagógico e Monitor DIP-BR", data_inicio: "2026-07-30", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [] },
  { nome: "Manoela Bittencourt", codigo_pf: "137166", unidade: "ECTOLAB", org_depto: ORG_INTERNACIONAL, funcao: "Internacional - DIP", data_inicio: "2025-07-06", obs: null, area: AREA_INTERNACIONAL, role: null, areas_lideradas: [] },
  { nome: "Marcello Paskulin", codigo_pf: "128784", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-07-01", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Marcelo Silva", codigo_pf: "128856", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Epicon + Projeto acadêmico/pesquisa", data_inicio: "2019-01-01", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Marcia Toledo", codigo_pf: "128712", unidade: "Florianópolis", org_depto: ORG_DIP, funcao: "Voluntária DIP Florianópolis", data_inicio: "2015-10-10", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Marcos Ulaf", codigo_pf: "133261", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitoria DIP e Jurídico", data_inicio: "2018-02-01", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Maria de Lourdes Pekin-maludy", codigo_pf: "130222", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Voluntária DIP Foz", data_inicio: "2024-04-22", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Maria Gabriela", codigo_pf: "502663", unidade: "ECTOLAB", org_depto: ORG_FINANCEIRO, funcao: "Financeiro", data_inicio: "2023-11-29", obs: null, area: AREA_FINANCEIRO, role: "financeiro", areas_lideradas: [] },
  { nome: "Maria Marques", codigo_pf: "129398", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP SP", data_inicio: "2016-03-14", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Maria Silvia", codigo_pf: "139696", unidade: "São Paulo", org_depto: ORG_FINANCEIRO, funcao: "Financeiro", data_inicio: "2024-03-28", obs: null, area: AREA_FINANCEIRO, role: "financeiro", areas_lideradas: [] },
  { nome: "Maria Teixeira", codigo_pf: "507451", unidade: "São Paulo", org_depto: ORG_VOLUNTARIADO, funcao: "Equipe Voluntariado e DIP SP", data_inicio: "2025-09-03", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [] },
  { nome: "Mariana Cabral", codigo_pf: "134141", unidade: "São Paulo", org_depto: ORG_PARATECNOLOGICO, funcao: "Pesquisa", data_inicio: "2015-05-01", obs: null, area: AREA_PESQUISA, role: null, areas_lideradas: [] },
  { nome: "Maricy Teixeira", codigo_pf: "506995", unidade: "São Paulo", org_depto: ORG_VOLUNTARIADO, funcao: "Voluntariado", data_inicio: "2025-10-13", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [] },
  { nome: "Máris Polo Paz", codigo_pf: "129880", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Coordenadora DIP", data_inicio: "2025-04-15", obs: null, area: AREA_DIP, role: "coordenador_area", areas_lideradas: [AREA_DIP] },
  { nome: "Marlise Royer", codigo_pf: "130978", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-07-08", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Mauro Buerger", codigo_pf: "139480", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitor DIP", data_inicio: "2019-06-01", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Mauro Ferreira", codigo_pf: "506055", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-07-15", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Mauro Oliveira", codigo_pf: "509587", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2025-07-01", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Miryan Akemi Ishikawa", codigo_pf: "504996", unidade: "São Paulo", org_depto: ORG_COORD_GERAL, funcao: "Coordenação ECTOLAB SP", data_inicio: "2019-09-06", obs: null, area: AREA_COORD_GERAL, role: "coordenador_area", areas_lideradas: ["São Paulo"] },
  { nome: "Munir Bazzi", codigo_pf: "129409", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-09-27", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Myriam Sanchez", codigo_pf: "129135", unidade: "ECTOLAB", org_depto: ORG_COORD_GERAL, funcao: "Coordenação Geral", data_inicio: "2025-04-15", obs: null, area: AREA_COORD_GERAL, role: null, areas_lideradas: [] },
  { nome: "Natalia Amendola", codigo_pf: "132409", unidade: "ECTOLAB", org_depto: ORG_PARATECNOLOGICO, funcao: "Voluntária projeto", data_inicio: "2024-12-09", obs: null, area: AREA_PARATECNOLOGICO, role: null, areas_lideradas: [] },
  { nome: "Nelson Figueiredo Junior", codigo_pf: "137840", unidade: "Florianópolis", org_depto: ORG_PARATECNOLOGICO, funcao: "Monitoria DIP FLORIPA", data_inicio: "2024-09-09", obs: null, area: AREA_PARATECNOLOGICO, role: null, areas_lideradas: [] },
  { nome: "Patrícia Carneiro", codigo_pf: "509164", unidade: "Portugal", org_depto: ORG_INTERNACIONAL, funcao: "Intercooperação Internacional", data_inicio: "2024-11-27", obs: null, area: AREA_INTERNACIONAL, role: null, areas_lideradas: [] },
  { nome: "Paula Nogara", codigo_pf: "136547", unidade: "Curitiba", org_depto: ORG_ECTOLAB, funcao: "Voluntária pesquisa", data_inicio: "2016-03-01", obs: null, area: AREA_PESQUISA, role: null, areas_lideradas: [] },
  { nome: "Paulo Battistella", codigo_pf: "131738", unidade: "Florianópolis", org_depto: ORG_PARAPEDAGOGICO, funcao: "Parapedagógico", data_inicio: "2025-04-15", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [] },
  { nome: "Paulo Franco", codigo_pf: "134040", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "DIP e Financeiro", data_inicio: "2018-02-01", obs: null, area: AREA_DIP, role: "financeiro", areas_lideradas: [] },
  { nome: "Rafael Pereira", codigo_pf: "138639", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP São Paulo", data_inicio: "2025-06-08", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Regina Krupka", codigo_pf: "137631", unidade: "São Paulo", org_depto: ORG_VOLUNTARIADO, funcao: "Coord Geral Voluntariado e Coord. DIP São Paulo", data_inicio: "2025-04-15", obs: null, area: AREA_VOLUNTARIADO, role: "voluntariado", areas_lideradas: [] },
  { nome: "Rinaldo Nishimura", codigo_pf: "129088", unidade: "ECTOLAB", org_depto: ORG_FINANCEIRO, funcao: "Coordenador Financeiro e DIP", data_inicio: "2025-04-15", obs: null, area: AREA_FINANCEIRO, role: "financeiro", areas_lideradas: [] },
  { nome: "Rosangela Medeiros", codigo_pf: "134366", unidade: "ECTOLAB", org_depto: ORG_BIOENERGOLOGIA, funcao: "Bioenergologia", data_inicio: "2022-09-14", obs: null, area: AREA_BIOENERGOLOGIA, role: null, areas_lideradas: [] },
  { nome: "Sonia Souza", codigo_pf: "137498", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Voluntário DIP", data_inicio: "2014-02-10", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Sonya Maria Ruiz", codigo_pf: "140366", unidade: "ECTOLAB", org_depto: ORG_VOLUNTARIADO, funcao: "Parapedagógico", data_inicio: "2022-02-22", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [] },
  { nome: "Tania Mendes", codigo_pf: "138231", unidade: "Rio de Janeiro", org_depto: ORG_FINANCEIRO, funcao: "Monitoria DIP RJ", data_inicio: "2024-07-24", obs: null, area: AREA_FINANCEIRO, role: null, areas_lideradas: [] },
  { nome: "Thiago Pontes", codigo_pf: "135495", unidade: "Curitiba", org_depto: ORG_VOLUNTARIADO, funcao: "Monitoria DIP", data_inicio: "2022-07-11", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [] },
  { nome: "Thiago Ribeiro", codigo_pf: "509242", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Comunicação", data_inicio: "2025-03-07", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Vânia Cabral", codigo_pf: "507287", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2025-06-08", obs: null, area: AREA_DIP, role: null, areas_lideradas: [] },
  { nome: "Viviane Aparecida de Sousa", codigo_pf: "130983", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2022-10-17", obs: "Afastou 17/04/25 por 6 meses", area: AREA_DIP, role: null, areas_lideradas: [] },
];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Faltam variáveis de ambiente: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const volunteer of VOLUNTEERS) {
    const { data: existing } = await supabase
      .from("voluntarios")
      .select("id")
      .eq("codigo_pf", volunteer.codigo_pf)
      .maybeSingle();

    const payload = {
      nome: volunteer.nome,
      codigo_pf: volunteer.codigo_pf,
      unidade: volunteer.unidade,
      org_depto: volunteer.org_depto,
      funcao: volunteer.funcao,
      data_inicio: volunteer.data_inicio,
      data_saida: null,
      obs: volunteer.obs,
      area_atuacao: volunteer.area,
      role: volunteer.role,
      areas_lideradas: volunteer.areas_lideradas,
      ativo: true,
    };

    if (existing) {
      const { error } = await supabase
        .from("voluntarios")
        .update(payload)
        .eq("id", existing.id);
      if (error) {
        console.error(`Falha ao atualizar ${volunteer.nome} (${volunteer.codigo_pf}): ${error.message}`);
        failed += 1;
      } else {
        updated += 1;
      }
      continue;
    }

    const { error } = await supabase.from("voluntarios").insert(payload);
    if (error) {
      console.error(`Falha ao criar ${volunteer.nome} (${volunteer.codigo_pf}): ${error.message}`);
      failed += 1;
    } else {
      created += 1;
    }
  }

  console.log(
    `\nConcluído: ${created} criados, ${updated} atualizados, ${failed} falhas (total da lista: ${VOLUNTEERS.length}).`
  );
}

main();
