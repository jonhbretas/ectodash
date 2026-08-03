# EctoDash

Sistema de gestão para voluntários de uma instituição sem fins lucrativos de pesquisa e experimentação — centraliza demandas/tarefas com prazos e responsáveis, lembretes automáticos por e-mail, transcrição de reuniões resumida por IA, e um dashboard financeiro sincronizado com a planilha de fluxo de caixa da instituição. Veja `.planning/PROJECT.md` para o escopo completo e o core value do produto.

Login é feito **somente** por e-mail institucional via link mágico (magic link) — não há cadastro próprio (self-signup) e não há senha em nenhum momento. Um coordenador convida cada voluntário (veja "Onboarding de um voluntário" abaixo); qualquer outro endereço que tente entrar não recebe acesso.

## Pré-requisitos

- Node.js 24+
- Um projeto Supabase hospedado (camada gratuita) já criado — não é necessário Docker nem Supabase local
- Uma conta Vercel (apenas para deploy; não é necessária para rodar localmente)

## Rodando localmente

```bash
cp .env.local.example .env.local
# preencha .env.local com as credenciais do seu projeto Supabase
npm install
npm run dev
```

Abra http://localhost:3000 — a aplicação roda inteiramente contra o projeto Supabase hospedado (não há backend local separado).

## Testes

```bash
npm test
```

Alguns testes de integração (sessão real, e-mail institucional) só rodam com `SUPABASE_SERVICE_ROLE_KEY` presente em `.env.local`; sem ela, aparecem como "skipped" de forma visível.

## Onboarding de um voluntário

Como não há self-signup, cada voluntário precisa ser cadastrado uma vez pelo coordenador:

```bash
npm run seed:coordinator -- <email-institucional>
```

Isso convida o e-mail informado via Supabase Auth. A Fase 2 substitui este comando por uma tela de convite dentro do próprio painel.

## Deploy

```bash
vercel --prod
```

O projeto já está vinculado (`vercel link`) ao projeto `ectodash` na Vercel, com as variáveis de ambiente de produção configuradas (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`). Após qualquer mudança na URL de produção, atualize também o allow-list de redirect no Supabase Dashboard → Authentication → URL Configuration — caso contrário os links de e-mail em produção redirecionam para localhost.
