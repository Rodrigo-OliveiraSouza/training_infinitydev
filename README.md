# training.infinity.dev

Plataforma de aprendizagem de programacao com gamificacao, trilhas, desafios em terminal e ranking.

## Arquitetura (diagrama textual)

[Browser]
  |-- UI (HTML/CSS/JS) + quizzes + terminal
  |-- JWT (localStorage)
  v
[API Express]
  |-- Auth / Conteudo / Progresso / Rankings
  |-- Correcao e normalizacao de saida
  |-- Executor (local ou Docker)
  v
[SQLite]
  |-- users, languages, levels, submissions, progress, sessions

Execucao de codigo:
API -> Executor -> Sandbox (local ou Docker) -> Resultado -> Engine de correcao

## Estrutura do repositorio

- backend/
  - src/ (API, auth, services, executor, utils)
  - migrations/ (schema SQL)
  - seeds/ (geracao das 60 fases por linguagem)
  - executor-images/ (Dockerfiles para sandbox)
- frontend/
  - *.html (landing, login, register, choose-language, map, level)
  - assets/ (CSS e JS)

## Modelo de dados (tabelas principais)

- users (id, username, email, password_hash, primary_language_id, created_at)
- languages (id, name)
- levels (id, language_id, order_index, title, theory_md, example_md, quiz_json, challenge_json, correction_config_json)
- submissions (id, user_id, level_id, session_id, code, language, status, exec_stdout, exec_stderr, runtime_ms)
- user_level_progress (user_id, level_id, best_time_ms, attempts_count, completed_at)
- level_sessions (id, user_id, level_id, started_at, last_run_at, ended_at)

Migrations: `backend/migrations/001_init.sql`

## API (rotas)

Auth:
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/recover
- POST /api/auth/logout
- GET /api/auth/me
- PATCH /api/auth/me/language

Conteudo:
- GET /api/languages
- GET /api/languages/{id}/levels
- GET /api/levels/{id}
- POST /api/levels/{id}/start
- POST /api/levels/{id}/run
- POST /api/levels/{id}/submit

Rankings:
- GET /api/leaderboard/levels/{id}
- GET /api/leaderboard/global

Progresso:
- GET /api/progress

## Engine de correcao

Estrategias suportadas:
- Saida exata com normalizacao (quebras de linha e espacos finais)
- Regex
- Casos de teste (input -> output)
- Similaridade (implementada, mas usada somente quando configurada)

## Execucao segura

Modo local (padrao):
- Execucao em pasta temporaria
- Timeout rigido por processo
- Saida truncada

Modo Docker (recomendado para isolamento):
- `EXECUTION_MODE=docker`
- `docker build -t codequest-python -f backend/executor-images/python.Dockerfile backend/executor-images`
- `docker build -t codequest-java -f backend/executor-images/java.Dockerfile backend/executor-images`

Docker roda com `--network none`, limite de memoria e pids.

## UI/UX

- Landing page com CTA
- Login e cadastro
- Onboarding de linguagem
- Minimapa com 60 fases e status
- Tela da fase com teoria, exemplo, quiz, terminal e desafio

## Seeds

- 60 fases para Python, Java e Rede
- Estruturadas em 10 modulos de 6 fases
- Inclui fases iniciais de "Olá, mundo" e input/saudacao
- Para atualizar conteudos existentes, use `SEED_UPDATE=true npm run seed`.

## Como executar (dev)

1) Backend

```
cd backend
npm install
npm run migrate
npm run seed
npm run dev
```

Se precisar ajustar configuracoes, copie `.env.example` para `.env`.

2) Acessar

Abra `http://localhost:3000`.

## Validacoes e seguranca

- Senhas com bcrypt
- JWT em Authorization header
- Limitacao de tempo na execucao
- Saida normalizada para comparacao

## Checklist de testes

- Cadastro e login (username e email unicos)
- Onboarding e troca de linguagem
- Bloqueio/desbloqueio de fases
- Correcao por testes e regex
- Tempo calculado por sessao
- Rankings por fase e geral
- Falhas de compilacao e runtime

## Casos de borda

- Nivel sem progresso (ranking vazio)
- Entrada com espacos extras
- Saida com quebras de linha finais
- Timeouts em loops infinitos

## Observacoes

- `RUN_TIMEOUT_MS` e `RUN_MEMORY_MB` em `.env`.
- Para producao, use o modo Docker com imagens atualizadas.
- Banco usa `sql.js` (WASM) para evitar dependencias nativas em Windows.

## Deploy em dominio Cloudflare

- Guia completo para `training.infinity.dev.br`: `DEPLOY_CLOUDFLARE.md`.
