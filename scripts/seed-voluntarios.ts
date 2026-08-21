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
  email?: string | null;
  telefone1?: string | null;
  telefone2?: string | null;
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
  { nome: "Alexandre de Padua", codigo_pf: "505418", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP SP", data_inicio: "2023-05-03", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "a3hdrive@hotmail.com", telefone1: "(13) 98113-4655", telefone2: "(13) 98433-3210" },
  { nome: "Almir Pereira", codigo_pf: "133680", unidade: "ECTOLAB", org_depto: ORG_FINANCEIRO, funcao: "Financeiro", data_inicio: "2020-05-22", obs: "Operador de StreamYard", area: AREA_FINANCEIRO, role: "financeiro", areas_lideradas: [], email: "almirsantospereira@gmail.com", telefone1: "(11) 97111-4573", telefone2: "11-99627-9518" },
  { nome: "Ana Prado", codigo_pf: "137062", unidade: "ECTOLAB", org_depto: ORG_PARAPEDAGOGICO, funcao: "Coordenação Parapedagogia", data_inicio: "2025-04-15", obs: null, area: AREA_PARAPEDAGOGICO, role: "coordenador_area", areas_lideradas: [AREA_PARAPEDAGOGICO], email: "anaacup20@gmail.com", telefone1: "+5541998852257", telefone2: "(45) 99106-5051" },
  { nome: "Ana Yogan", codigo_pf: "131351", unidade: "ECTOLAB", org_depto: ORG_INTERNACIONAL, funcao: "Voluntária Internacional", data_inicio: "2024-03-24", obs: null, area: AREA_INTERNACIONAL, role: null, areas_lideradas: [], email: "amabrao@gmail.com", telefone1: "+1 (561) 414-0229", telefone2: null },
  { nome: "Andre Pedretti", codigo_pf: "503589", unidade: "ECTOLAB", org_depto: ORG_FINANCEIRO, funcao: "Financeiro e DIP Foz", data_inicio: "2025-01-13", obs: null, area: AREA_FINANCEIRO, role: "financeiro", areas_lideradas: [], email: "andre.pedretti@gmail.com", telefone1: "+55 41995382020", telefone2: "+55 41995382020" },
  { nome: "Angela Mattia", codigo_pf: "508397", unidade: "ECTOLAB", org_depto: ORG_INTERNACIONAL, funcao: "Internacional - DIP", data_inicio: "2025-12-19", obs: null, area: AREA_INTERNACIONAL, role: null, areas_lideradas: [], email: "ange_mattia@hotmail.com", telefone1: "(00) 00000-0000", telefone2: null },
  { nome: "Antonio Magalhães", codigo_pf: "131632", unidade: "ECTOLAB", org_depto: ORG_VOLUNTARIADO, funcao: "Infraestrutura - 2025 Projeto", data_inicio: "2022-12-19", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [], email: "apintoleitemagalhaes@gmail.com", telefone1: "(45) 99112-2800", telefone2: "(45) 99112-2882" },
  { nome: "Aparecida Polastre Fonseca", codigo_pf: "128959", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-07-01", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "polastre026@gmail.com", telefone1: "(45) 99942-9233", telefone2: "(45) 99122-9592" },
  { nome: "Bruno Rafael Gris", codigo_pf: "138028", unidade: "ECTOLAB", org_depto: ORG_FINANCEIRO, funcao: null, data_inicio: "2023-02-20", obs: "Em 03/08/2024 solicitou afastamento por 3 meses", area: AREA_FINANCEIRO, role: null, areas_lideradas: [], email: "brunorgris@gmail.com", telefone1: "(45) 99933-1478", telefone2: "(45) 99119-4148" },
  { nome: "Camila Lass", codigo_pf: "139546", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitoria DIP Curitiba", data_inicio: "2023-09-04", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "camila.lass@gmail.com", telefone1: "(41) 99971-2681", telefone2: "(41) 99997-3577" },
  { nome: "Carlos Cardoso", codigo_pf: "136486", unidade: "ECTOLAB", org_depto: ORG_INTERNACIONAL, funcao: "Internacional - DIP", data_inicio: "2025-12-19", obs: null, area: AREA_INTERNACIONAL, role: null, areas_lideradas: [], email: "cardoso.c@web.de", telefone1: null, telefone2: "(49) 15191-7583" },
  { nome: "Celeste Silveira", codigo_pf: "129395", unidade: "Brasília", org_depto: ORG_PARAPEDAGOGICO, funcao: "Voluntário", data_inicio: "2016-07-01", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [], email: "celesteaidasilveira@gmail.com", telefone1: "(61) 99223-7959", telefone2: "(61) 3347-4979" },
  { nome: "Christian Andrade", codigo_pf: "132371", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitoria DIP e Comunicação", data_inicio: "2023-02-27", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "christiandeandrade@gmail.com", telefone1: "(41) 3206-5559", telefone2: "(41) 99824-5896" },
  { nome: "Claudia Adele Cardoso", codigo_pf: "133726", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2025-07-11", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "claudiaadele@rocketmail.com", telefone1: "(11) 98585-8875", telefone2: "(11) 97513-5400" },
  { nome: "Dalvan Brum", codigo_pf: "502990", unidade: "ECTOLAB", org_depto: ORG_PARAPEDAGOGICO, funcao: "Administrativo Parapedagógico e Monitor DIP-RS", data_inicio: "2026-07-29", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [], email: "brum.dt@gmail.com", telefone1: "51982769241", telefone2: "+55 51 8276-9241" },
  { nome: "Daniel Fernandes Pires", codigo_pf: "508352", unidade: "ECTOLAB", org_depto: ORG_COMUNICACAO, funcao: "Equipe de Comunicação", data_inicio: "2025-04-15", obs: null, area: AREA_COMUNICACAO, role: null, areas_lideradas: [], email: "danielcrfp@hotmail.com", telefone1: "(13) 99201-9242", telefone2: "(13) 99183-3868" },
  { nome: "Derick Milan", codigo_pf: "509349", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP SP", data_inicio: "2024-07-17", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "derickmilani@gmail.com", telefone1: "(11) 99598-2323", telefone2: "(11) 98811-5094" },
  { nome: "Diogo Pupin Duarte", codigo_pf: "133526", unidade: "ECTOLAB", org_depto: ORG_INTERNACIONAL, funcao: "Internacional - DIP", data_inicio: "2025-07-06", obs: null, area: AREA_INTERNACIONAL, role: null, areas_lideradas: [], email: "projeciolino@googlemail.com", telefone1: "01785804985", telefone2: "49(0)178 919 8785" },
  { nome: "Eduardo Azevedo", codigo_pf: "130943", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2025-01-22", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "eduardo.azevedo.ccci@gmail.com", telefone1: "(45) 99104-1011", telefone2: "(45) 98824-6868" },
  { nome: "Eduardo Doria", codigo_pf: "129107", unidade: "Curitiba", org_depto: ORG_ECTOLAB, funcao: "Monitoria DIP", data_inicio: "2022-08-13", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "edudoria1365@icloud.com", telefone1: "(41) 98739-7378", telefone2: "(41) 99105-0980" },
  { nome: "Eduardo Vicenzi", codigo_pf: "128758", unidade: "ECTOLAB", org_depto: ORG_INTERNACIONAL, funcao: "Internacional - DIP - EPICON", data_inicio: "2025-12-19", obs: null, area: AREA_INTERNACIONAL, role: null, areas_lideradas: [], email: "vicenzi@t-online.de", telefone1: "(41) 3209-8986", telefone2: "+49 17650991354" },
  { nome: "Eliana Francilio", codigo_pf: "503007", unidade: "ECTOLAB", org_depto: ORG_VOLUNTARIADO, funcao: "Atividades do voluntariado", data_inicio: "2026-04-09", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [], email: "eofrancilio@gmail.com", telefone1: "(53) 99911-7065", telefone2: null },
  { nome: "Eliane Amarante", codigo_pf: "130069", unidade: "ECTOLAB", org_depto: ORG_COMUNICACAO, funcao: "Coordenadora Com. e Eventos", data_inicio: "2025-04-15", obs: null, area: AREA_COMUNICACAO, role: "coordenador_area", areas_lideradas: [AREA_COMUNICACAO], email: "eliane.amarante22@gmail.com", telefone1: "(45) 99954-8285", telefone2: "(45) 99904-9757" },
  { nome: "Eliane Cardoso", codigo_pf: "130160", unidade: "Rio de Janeiro", org_depto: ORG_DIP, funcao: "Monitora DIP RJ", data_inicio: "2018-08-16", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "elicardoso543@yahoo.com.br", telefone1: "(22) 98837-2772", telefone2: "(14) 99161-5101" },
  { nome: "Érica de Carvalho Monteiro", codigo_pf: "129259", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Indefinida", data_inicio: "2023-03-06", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "ericadecarvalhomonteiro@gmail.com", telefone1: "(45) 99918-1234", telefone2: "(31) 99958-1930" },
  { nome: "Estela Leal", codigo_pf: "135819", unidade: "Brasília", org_depto: ORG_PARAPEDAGOGICO, funcao: "Docência OGB e DIP Brasília", data_inicio: "2022-05-16", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [], email: "estela.leal@gmail.com", telefone1: "(62) 98118-9068", telefone2: "(62) 98101-9191" },
  { nome: "Fabi Pereira", codigo_pf: "506511", unidade: "ECTOLAB", org_depto: ORG_COMUNICACAO, funcao: "Comunicação", data_inicio: "2022-05-10", obs: null, area: AREA_COMUNICACAO, role: null, areas_lideradas: [], email: "fabis.pereira82@gmail.com", telefone1: "(85) 98888-5494", telefone2: "(85) 98888-5494" },
  { nome: "Fabiana Cerato", codigo_pf: "128844", unidade: "ECTOLAB", org_depto: ORG_VOLUNTARIADO, funcao: "Arquitetura", data_inicio: "2022-10-26", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [], email: "diretoriaarquiteturaharmonia@gmail.com", telefone1: "(45) 99977-4282", telefone2: null },
  { nome: "Fátima Fernandes", codigo_pf: "132967", unidade: "ECTOLAB", org_depto: ORG_ECTOLAB, funcao: "Voluntário de projeto - Livro", data_inicio: "2024-08-20", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [], email: "fatima.ofernandes@gmail.com", telefone1: "45991152143", telefone2: null },
  { nome: "Fernanda Saad", codigo_pf: "511187", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-11-13", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "psicologiasaad@gmail.com", telefone1: "(41) 99769-7490", telefone2: "(41) 99903-4066" },
  { nome: "Flávia Rogick", codigo_pf: "129021", unidade: "ECTOLAB", org_depto: ORG_PARAPEDAGOGICO, funcao: "Voluntária", data_inicio: "2025-06-16", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [], email: "flaviarogick@gmail.com", telefone1: "(45) 9919-6637", telefone2: null },
  { nome: "Francisco Ávila", codigo_pf: "140296", unidade: "Portugal", org_depto: ORG_INTERNACIONAL, funcao: "Coordenador Intercooperação Internacional", data_inicio: "2025-04-15", obs: null, area: AREA_INTERNACIONAL, role: "coordenador_area", areas_lideradas: [AREA_INTERNACIONAL], email: "xicodopico@gmail.com", telefone1: "(+351 91) 8452-388", telefone2: "00351 918186450" },
  { nome: "Giuliano Ginani", codigo_pf: "503427", unidade: "ECTOLAB", org_depto: ORG_PARATECNOLOGICO, funcao: "Laboratório de Ectoplasmia", data_inicio: "2025-02-26", obs: null, area: AREA_PARATECNOLOGICO, role: null, areas_lideradas: [], email: "giuliano.ginani@gmail.com", telefone1: "(54) 99148-9653", telefone2: "(45) 99919-1833" },
  { nome: "Goretti Lopes", codigo_pf: "128816", unidade: "Rio de Janeiro", org_depto: ORG_DIP, funcao: "DIP RJ", data_inicio: "2018-02-11", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "gorettilopeslau@yahoo.com.br", telefone1: "(55) 22998-5137", telefone2: null },
  { nome: "Graziele Cunha", codigo_pf: "506704", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-08-14", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "grazieleheichuk@gmail.com", telefone1: "(41) 98496-4959", telefone2: "(41) 99871-6839" },
  { nome: "Hercilio Lau", codigo_pf: "129014", unidade: "Rio de Janeiro", org_depto: ORG_DIP, funcao: "Monitoria DIP RJ", data_inicio: "2018-02-02", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "herciliolau18@yahoo.com", telefone1: "(22) 99884-5087", telefone2: "(22) 99884-5087" },
  { nome: "Hernande Leite", codigo_pf: "129136", unidade: "São Paulo", org_depto: ORG_PARAPEDAGOGICO, funcao: "Parapedagógico", data_inicio: "2025-07-24", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [], email: "hleite12@gmail.com", telefone1: "(45) 99999-3553", telefone2: null },
  { nome: "Ismael Pinheiro Junior", codigo_pf: "135193", unidade: "ECTOLAB", org_depto: ORG_ECTOLAB, funcao: "Técnico científico - Pesquisa", data_inicio: "2013-05-01", obs: null, area: AREA_PESQUISA, role: null, areas_lideradas: [], email: "ismael@medicinachinesa.com", telefone1: "62994223000", telefone2: "(62) 99528-0613" },
  { nome: "Janete Rousselet de Souza", codigo_pf: "135874", unidade: "ECTOLAB", org_depto: ORG_VOLUNTARIADO, funcao: "Equipe voluntariado", data_inicio: "2025-04-15", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [], email: "neterou@gmail.com", telefone1: "(51) 3785-6098", telefone2: "(51) 98179-2014" },
  { nome: "Jaqueline Barcellos", codigo_pf: "505186", unidade: "Brasília", org_depto: ORG_PARAPEDAGOGICO, funcao: "Parapedagógico", data_inicio: "2024-12-04", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [], email: "jbarcellos26@gmail.com", telefone1: "61996979365", telefone2: "(61) 99206-0406" },
  { nome: "João Alberto de Oliveira", codigo_pf: "138461", unidade: "ECTOLAB", org_depto: ORG_VOLUNTARIADO, funcao: "Voluntário por projeto - Dodecaedro", data_inicio: "2023-05-02", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [], email: "pedipinha1@gmail.com", telefone1: "(55) 43999-7334", telefone2: "(43) 99974-5130" },
  { nome: "Jonathan Bretas", codigo_pf: "509709", unidade: "ECTOLAB", org_depto: ORG_COORD_GERAL, funcao: "Coordenação Geral", data_inicio: "2025-04-15", obs: null, area: AREA_COORD_GERAL, role: "coordenador_geral", areas_lideradas: [], email: "jonathanbretas@gmail.com", telefone1: "45991535300", telefone2: "21-97508-3922" },
  { nome: "Jorge Washington de Camargo", codigo_pf: "134020", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-07-07", obs: "Afastado p/ 6 meses a partir de 03/09/2025", area: AREA_DIP, role: null, areas_lideradas: [], email: "jorgewashington11@hotmail.com", telefone1: "(45) 99804-6548", telefone2: "(45) 99830-6284" },
  { nome: "Jose Luis Ara Sobrinho", codigo_pf: "132600", unidade: "Curitiba", org_depto: ORG_ECTOLAB, funcao: "Coordenação Curitiba", data_inicio: "2025-06-19", obs: null, area: AREA_COORD_GERAL, role: "coordenador_area", areas_lideradas: ["Curitiba"], email: "luisara@onda.com.br", telefone1: "(41) 99235-8502", telefone2: "41 9235-8502" },
  { nome: "Juliana de Souza Medeiros", codigo_pf: "132906", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2023-10-04", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "julasm@gmail.com", telefone1: "(45) 99155-0711", telefone2: "(45) 99907-0111" },
  { nome: "Keity Naira Girardi", codigo_pf: "136444", unidade: "Santa Catarina", org_depto: ORG_ECTOLAB, funcao: null, data_inicio: "2019-07-31", obs: "Sem informação", area: null, role: null, areas_lideradas: [], email: "keitynaira@gmail.com", telefone1: "(47) 99973-1991", telefone2: "(47) 3382-6217" },
  { nome: "Leonardo Paludeto", codigo_pf: "129143", unidade: "ECTOLAB", org_depto: ORG_PARATECNOLOGICO, funcao: "Voluntário projeto", data_inicio: "2024-10-20", obs: null, area: AREA_PARATECNOLOGICO, role: null, areas_lideradas: [], email: "lpaludeto@gmail.com", telefone1: "(45) 99151-2530", telefone2: "(45) 99151-2530" },
  { nome: "Leopoldo de Macedo", codigo_pf: "510532", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitoria DIP Curitiba e Comunicação", data_inicio: "2024-12-18", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "leopoldocruzneto@gmail.com", telefone1: "(41) 99927-7789", telefone2: "(41) 98726-0159" },
  { nome: "Lidia Bolfe", codigo_pf: "137427", unidade: "ECTOLAB", org_depto: ORG_BIOENERGOLOGIA, funcao: "Coordenação Bioenergologia", data_inicio: "2025-04-15", obs: null, area: AREA_BIOENERGOLOGIA, role: "coordenador_area", areas_lideradas: [AREA_BIOENERGOLOGIA], email: "lidiabolfe@gmail.com", telefone1: "(41) 99172-0490", telefone2: null },
  { nome: "Lucas Rinaldi", codigo_pf: "137813", unidade: "ECTOLAB", org_depto: ORG_COORD_GERAL, funcao: "Coordenação geral", data_inicio: "2020-04-10", obs: "Afastou em 17/04/25 por 6 meses", area: AREA_COORD_GERAL, role: null, areas_lideradas: [], email: "lucas@maxcons.com.br", telefone1: "(11) 99599-4585", telefone2: "(11) 98414-0491" },
  { nome: "Luciano Guerini", codigo_pf: "505482", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Coordenação DIP", data_inicio: "2017-04-08", obs: null, area: AREA_DIP, role: "coordenador_area", areas_lideradas: [AREA_DIP], email: "luciano-guerini@hotmail.com", telefone1: "41998322858", telefone2: null },
  { nome: "Luiz Antonio Rezende Lima", codigo_pf: "138982", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitor DIP FOZ", data_inicio: "2026-07-10", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "rezende.lal@gmail.com", telefone1: "(31) 99239-1269", telefone2: null },
  { nome: "Luiz Claudio Pereira Costa", codigo_pf: "135678", unidade: "Brasília", org_depto: ORG_PARAPEDAGOGICO, funcao: "Administrativo do Parapedagógico e Monitor DIP-BR", data_inicio: "2026-07-30", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [], email: "luizclaudio.psi@gmail.com", telefone1: "(61) 99826-1112", telefone2: "(61) 3448-6404" },
  { nome: "Manoela Bittencourt", codigo_pf: "137166", unidade: "ECTOLAB", org_depto: ORG_INTERNACIONAL, funcao: "Internacional - DIP", data_inicio: "2025-07-06", obs: null, area: AREA_INTERNACIONAL, role: null, areas_lideradas: [], email: "manoela@gmx.net", telefone1: "+491789198785", telefone2: "49 178 5804985" },
  { nome: "Marcello Paskulin", codigo_pf: "128784", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-07-01", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "mpaskulin@gmail.com", telefone1: "(45) 99912-2901", telefone2: "(45) 99157-7128" },
  { nome: "Marcelo Silva", codigo_pf: "128856", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Epicon + Projeto acadêmico/pesquisa", data_inicio: "2019-01-01", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "renata_pialarissi@yahoo.com.br", telefone1: "(45) 99991-6997", telefone2: "(45) 99920-8701" },
  { nome: "Marcia Toledo", codigo_pf: "128712", unidade: "Florianópolis", org_depto: ORG_DIP, funcao: "Voluntária DIP Florianópolis", data_inicio: "2015-10-10", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "marciac.toledo@gmail.com", telefone1: "(48) 98411-8444", telefone2: "(48) 98404-9194" },
  { nome: "Marcos Ulaf", codigo_pf: "133261", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitoria DIP e Jurídico", data_inicio: "2018-02-01", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "marcos@unpadvogados.com.br", telefone1: "(41) 99615-0929", telefone2: "41-99824-8009" },
  { nome: "Maria de Lourdes Pekin-maludy", codigo_pf: "130222", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Voluntária DIP Foz", data_inicio: "2024-04-22", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "maludypekin@yahoo.com.br", telefone1: "(45) 99151-5145", telefone2: "(45) 99151-1950" },
  { nome: "Maria Gabriela", codigo_pf: "502663", unidade: "ECTOLAB", org_depto: ORG_FINANCEIRO, funcao: "Financeiro", data_inicio: "2023-11-29", obs: null, area: AREA_FINANCEIRO, role: "financeiro", areas_lideradas: [], email: "mariagabiab@gmail.com", telefone1: "(45) 99133-1478", telefone2: "(45) 99119-4148" },
  { nome: "Maria Marques", codigo_pf: "129398", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP SP", data_inicio: "2016-03-14", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "mariamarquessilva@gmail.com", telefone1: "11998298519", telefone2: null },
  { nome: "Maria Silvia", codigo_pf: "139696", unidade: "São Paulo", org_depto: ORG_FINANCEIRO, funcao: "Financeiro", data_inicio: "2024-03-28", obs: null, area: AREA_FINANCEIRO, role: "financeiro", areas_lideradas: [], email: "sil-moraes@uol.com.br", telefone1: "(19) 99769-6922", telefone2: null },
  { nome: "Maria Teixeira", codigo_pf: "507451", unidade: "São Paulo", org_depto: ORG_VOLUNTARIADO, funcao: "Equipe Voluntariado e DIP SP", data_inicio: "2025-09-03", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [], email: "maricy.teix@gmail.com", telefone1: "(11) 97626-3362", telefone2: "(11) 96925-5595" },
  { nome: "Mariana Cabral", codigo_pf: "134141", unidade: "São Paulo", org_depto: ORG_PARATECNOLOGICO, funcao: "Pesquisa", data_inicio: "2015-05-01", obs: null, area: AREA_PESQUISA, role: null, areas_lideradas: [], email: "marycabral101@gmail.com", telefone1: "(11) 98219-8674", telefone2: "(11) 98722-2183" },
  { nome: "Maricy Teixeira", codigo_pf: "506995", unidade: "São Paulo", org_depto: ORG_VOLUNTARIADO, funcao: "Voluntariado", data_inicio: "2025-10-13", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [], email: "maricy.teix@gmail.com", telefone1: "+55 11976263362", telefone2: "+55 11976263362" },
  { nome: "Máris Polo Paz", codigo_pf: "129880", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Coordenadora DIP", data_inicio: "2025-04-15", obs: null, area: AREA_DIP, role: "coordenador_area", areas_lideradas: [AREA_DIP], email: "marispolopaz@gmail.com", telefone1: "(11) 99627-9518", telefone2: "(11) 99711-4573" },
  { nome: "Marlise Royer", codigo_pf: "130978", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-07-08", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "marlise_royer@yahoo.com.br", telefone1: "(61) 98148-0095", telefone2: "(45) -9993" },
  { nome: "Mauro Buerger", codigo_pf: "139480", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitor DIP", data_inicio: "2019-06-01", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "maurobuerger@gmail.com", telefone1: "(47) 99136-1616", telefone2: "(47) 99196-7778" },
  { nome: "Mauro Ferreira", codigo_pf: "506055", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-07-15", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "mauroftorres13@gmail.com", telefone1: "(11) 99512-2966", telefone2: "(11) 99664-2195" },
  { nome: "Mauro Oliveira", codigo_pf: "509587", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2025-07-01", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "mauro.oliveirajr3@gmail.com", telefone1: "11985223414", telefone2: "(11) 98522-3414" },
  { nome: "Miryan Akemi Ishikawa", codigo_pf: "504996", unidade: "São Paulo", org_depto: ORG_COORD_GERAL, funcao: "Coordenação ECTOLAB SP", data_inicio: "2019-09-06", obs: null, area: AREA_COORD_GERAL, role: "coordenador_area", areas_lideradas: ["São Paulo"], email: "miryanishikawa@gmail.com", telefone1: "(11) 99186-5054", telefone2: "(11) 97173-8900" },
  { nome: "Munir Bazzi", codigo_pf: "129409", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2024-09-27", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "munir_bazzi@yahoo.com.br", telefone1: "(41) 99902-9648", telefone2: "(41) 99193-6866" },
  { nome: "Myriam Sanchez", codigo_pf: "129135", unidade: "ECTOLAB", org_depto: ORG_COORD_GERAL, funcao: "Coordenação Geral", data_inicio: "2025-04-15", obs: null, area: AREA_COORD_GERAL, role: null, areas_lideradas: [], email: "myriam.leite@gmail.com", telefone1: "(45) 99915-3553", telefone2: "(45) 99999-3553" },
  { nome: "Natalia Amendola", codigo_pf: "132409", unidade: "ECTOLAB", org_depto: ORG_PARATECNOLOGICO, funcao: "Voluntária projeto", data_inicio: "2024-12-09", obs: null, area: AREA_PARATECNOLOGICO, role: null, areas_lideradas: [], email: "amendola.nat@gmail.com", telefone1: "(45) 98409-2536", telefone2: "45-98402-4847" },
  { nome: "Nelson Figueiredo Junior", codigo_pf: "137840", unidade: "Florianópolis", org_depto: ORG_PARATECNOLOGICO, funcao: "Monitoria DIP FLORIPA", data_inicio: "2024-09-09", obs: null, area: AREA_PARATECNOLOGICO, role: null, areas_lideradas: [], email: "neovernel@gmail.com", telefone1: "(48) 99810-4119", telefone2: "48-99978-0773" },
  { nome: "Patrícia Carneiro", codigo_pf: "509164", unidade: "Portugal", org_depto: ORG_INTERNACIONAL, funcao: "Intercooperação Internacional", data_inicio: "2024-11-27", obs: null, area: AREA_INTERNACIONAL, role: null, areas_lideradas: [], email: "mariapgc@hotmail.com", telefone1: "351 91845 2388", telefone2: "351 91900 0351" },
  { nome: "Paula Nogara", codigo_pf: "136547", unidade: "Curitiba", org_depto: ORG_ECTOLAB, funcao: "Voluntária pesquisa", data_inicio: "2016-03-01", obs: null, area: AREA_PESQUISA, role: null, areas_lideradas: [], email: "paularbnogara@yahoo.com.br", telefone1: "(42) 98833-8815", telefone2: "(42) 98815-9158" },
  { nome: "Paulo Battistella", codigo_pf: "131738", unidade: "Florianópolis", org_depto: ORG_PARAPEDAGOGICO, funcao: "Parapedagógico", data_inicio: "2025-04-15", obs: null, area: AREA_PARAPEDAGOGICO, role: null, areas_lideradas: [], email: "battistellaa@gmail.com", telefone1: "48996038022", telefone2: null },
  { nome: "Paulo Franco", codigo_pf: "134040", unidade: "Curitiba", org_depto: ORG_DIP, funcao: "DIP e Financeiro", data_inicio: "2018-02-01", obs: null, area: AREA_DIP, role: "financeiro", areas_lideradas: [], email: "pfranco.roberto@gmail.com", telefone1: "(41) 99982-2126", telefone2: "41-99685-3596" },
  { nome: "Rafael Pereira", codigo_pf: "138639", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP São Paulo", data_inicio: "2025-06-08", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "rafaguipe1402@gmail.com", telefone1: "(11) 96578-1661", telefone2: "(11) 96578-1661" },
  { nome: "Regina Krupka", codigo_pf: "137631", unidade: "São Paulo", org_depto: ORG_VOLUNTARIADO, funcao: "Coord Geral Voluntariado e Coord. DIP São Paulo", data_inicio: "2025-04-15", obs: null, area: AREA_VOLUNTARIADO, role: "voluntariado", areas_lideradas: [], email: "remakr@hotmail.com", telefone1: "(11) 99936-6888", telefone2: "(11) 99687-4479" },
  { nome: "Rinaldo Nishimura", codigo_pf: "129088", unidade: "ECTOLAB", org_depto: ORG_FINANCEIRO, funcao: "Coordenador Financeiro e DIP", data_inicio: "2025-04-15", obs: null, area: AREA_FINANCEIRO, role: "financeiro", areas_lideradas: [], email: "rnishimura.mv@gmail.com", telefone1: "(45) 99133-6227", telefone2: "(45) 99133-7963" },
  { nome: "Rosangela Medeiros", codigo_pf: "134366", unidade: "ECTOLAB", org_depto: ORG_BIOENERGOLOGIA, funcao: "Bioenergologia", data_inicio: "2022-09-14", obs: null, area: AREA_BIOENERGOLOGIA, role: null, areas_lideradas: [], email: "diniro_3@hotmail.com", telefone1: "(45) 99121-1330", telefone2: "(45) 99121-1330" },
  { nome: "Sonia Souza", codigo_pf: "137498", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Voluntário DIP", data_inicio: "2014-02-10", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "soniacarrasco@gmail.com", telefone1: "(11) 97251-8144", telefone2: "(11) 99779-8714" },
  { nome: "Sonya Maria Ruiz", codigo_pf: "140366", unidade: "ECTOLAB", org_depto: ORG_VOLUNTARIADO, funcao: "Parapedagógico", data_inicio: "2022-02-22", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [], email: "almafabfzauditoria@gmail.com", telefone1: "(85) 98672-9119", telefone2: "(85) 98672-9119" },
  { nome: "Tania Mendes", codigo_pf: "138231", unidade: "Rio de Janeiro", org_depto: ORG_FINANCEIRO, funcao: "Monitoria DIP RJ", data_inicio: "2024-07-24", obs: null, area: AREA_FINANCEIRO, role: null, areas_lideradas: [], email: "taniamendesm11@gmail.com", telefone1: "(22) 99900-3091", telefone2: "(22) 99996-1844" },
  { nome: "Thiago Pontes", codigo_pf: "135495", unidade: "Curitiba", org_depto: ORG_VOLUNTARIADO, funcao: "Monitoria DIP", data_inicio: "2022-07-11", obs: null, area: AREA_VOLUNTARIADO, role: null, areas_lideradas: [], email: "thiago.gutierrez@gmail.com", telefone1: "(41) 9990-1406", telefone2: "(41) 99901-4068" },
  { nome: "Thiago Ribeiro", codigo_pf: "509242", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Comunicação", data_inicio: "2025-03-07", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "thiagopsribeiro@gmail.com", telefone1: "69-99961-4259", telefone2: "(19) 98422-5050" },
  { nome: "Vânia Cabral", codigo_pf: "507287", unidade: "São Paulo", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2025-06-08", obs: null, area: AREA_DIP, role: null, areas_lideradas: [], email: "cabral.vania@gmail.com", telefone1: "(91) 91977-7350", telefone2: "(11) 96578-1661" },
  { nome: "Viviane Aparecida de Sousa", codigo_pf: "130983", unidade: "ECTOLAB", org_depto: ORG_DIP, funcao: "Monitoria DIP", data_inicio: "2022-10-17", obs: "Afastou 17/04/25 por 6 meses", area: AREA_DIP, role: null, areas_lideradas: [], email: "viviane@maxcons.com.br", telefone1: "(11) 98414-0491", telefone2: null },
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
      telefone1: volunteer.telefone1,
      telefone2: volunteer.telefone2,
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
