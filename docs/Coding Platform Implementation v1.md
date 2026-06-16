# Galgotias Coding Platform — Implementation Plan v2

---

## ✅ Section 1 — Foundation & Setup `COMPLETE`

| # | Task | Status |
|---|---|---|
| 1.1 | Initialize backend (Node.js + Express) | ✅ Done |
| 1.2 | Initialize frontend (React + Vite) | ✅ Done |
| 1.3 | Install Prisma + PostgreSQL (`pg`, `@prisma/adapter-pg`) | ✅ Done |
| 1.4 | Create `User` model in Prisma schema | ✅ Done |
| 1.5 | Run first Prisma migration | ✅ Done |
| 1.6 | Create `/health` check route | ✅ Done |
| 1.7 | Connect frontend → backend (Axios ping) | ✅ Done |
| 1.8 | Fix Prisma 7 driver adapter setup (`PrismaPg`) | ✅ Done |

---

## ✅ Section 2 — Complete Database Schema `COMPLETE`

> Schema is designed to support the AI pipeline from day one.

| # | Task | Status |
|---|---|---|
| 2.1 | Add `Difficulty` (`EASY/MEDIUM/HARD`) and `Visibility` (`PUBLIC/PRIVATE`) enums | ✅ Done |
| 2.2 | Add `Problem` model — `starterCode Json?` (Creator Agent deposits boilerplate), `isPublished Boolean` (AI validation gate), `timeLimitMs`, `memoryLimitKb` | ✅ Done |
| 2.3 | Add `TestCase` model — dual-representation: `input/expectedOutput` for Judge0 sandbox, `displayInput?/displayOutput?/explanation?` auto-filled by Creator Agent. `order Int`, `@@index([problemId])`, cascade delete from Problem | ✅ Done |
| 2.4 | Add `UserProblem` join table — composite unique index `(userId, problemId)` for upsert. Tracks `solved` + `submissions` count | ✅ Done |
| 2.5 | Add `userProblems UserProblem[]` relation back to existing `User` model | ✅ Done |
| 2.6 | Run `npx prisma migrate dev` | ✅ Done |
| 2.7 | Run `npx prisma generate` | ✅ Done |

---

## ⬜ Section 3 — Authentication System `NEXT`

> Restricted to `@galgotiasuniversity.edu.in` emails. Student ID as username.

| # | Task | Status |
|---|---|---|
| 3.1 | `POST /api/auth/register` — validate university email domain + student ID | ⬜ Todo |
| 3.2 | Hash user passwords using `bcrypt` or `argon2` before saving to the database | ⬜ Todo |
| 3.3 | OTP generation + send to university email (Nodemailer) | ⬜ Todo |
| 3.4 | `POST /api/auth/verify-otp` — activate account (`isVerified = true`) | ⬜ Todo |
| 3.5 | `POST /api/auth/login` — return signed JWT token | ⬜ Todo |
| 3.6 | Auth middleware — protect routes using JWT verification | ⬜ Todo |
| 3.7 | Frontend: Register, Login, OTP verification pages | ⬜ Todo |

---

## ⬜ Section 4 — Problem Management API

> Only published problems visible. PRIVATE test case data never sent to client.

| # | Task | Status |
|---|---|---|
| 4.1 | `GET /api/problems` — list all problems where `isPublished = true` | ⬜ Todo |
| 4.2 | `GET /api/problems/:id` — problem detail, only `PUBLIC` test cases in response | ⬜ Todo |
| 4.3 | Strip `input` and `expectedOutput` from `PRIVATE` test cases before responding | ⬜ Todo |
| 4.4 | Admin route: `POST /api/problems` — manually create problem + test cases | ⬜ Todo |

---

## ⬜ Section 5 — Code Execution Engine

> Judge0 integration with Base64 encoding, async polling, and early termination.

| # | Task | Status |
|---|---|---|
| 5.1 | Set up Judge0 locally via `docker-compose` for development testing | ⬜ Todo |
| 5.2 | `POST /api/execute` — **Run** route (custom input, no DB update, no progress tracking) | ⬜ Todo |
| 5.3 | `POST /api/submit` — **Submit** route (all test cases, upsert `UserProblem`) | ⬜ Todo |
| 5.4 | Base64 encode/decode + `\r\n → \n` sanitization on all payloads | ⬜ Todo |
| 5.5 | Async polling loop (300–500ms interval) for Judge0 status codes | ⬜ Todo |
| 5.6 | Early termination on first Compilation Error / TLE / Wrong Answer | ⬜ Todo |
| 5.7 | Upsert `UserProblem` on successful full submission | ⬜ Todo |

---

## ⬜ Section 6 — Frontend Code Editor UI

| # | Task | Status |
|---|---|---|
| 6.1 | Integrate Monaco Editor | ⬜ Todo |
| 6.2 | Implement debounce hook for Monaco Editor state updates to prevent performance lag | ⬜ Todo |
| 6.3 | Language selector — load matching `starterCode` from problem | ⬜ Todo |
| 6.4 | stdin input box for custom test input | ⬜ Todo |
| 6.5 | **Run** and **Submit** buttons with loading + disabled state | ⬜ Todo |
| 6.6 | Display stdout, stderr, verdict (Accepted / Wrong Answer / TLE / CE etc.) | ⬜ Todo |
| 6.7 | Show `PUBLIC` test cases on problem page | ⬜ Todo |

---

## ⬜ Section 7 — Multi-Agent AI Pipeline *(v1 Core Feature)*

> This is how ALL problems enter the platform. No manual problem entry.
> Tech: Python microservice + LangChain + LangGraph state machine.

| # | Task | Status |
|---|---|---|
| 7.1 | Set up Python microservice with LangChain + LangGraph | ⬜ Todo |
| 7.2 | **Creator Agent** — generates title, description, constraints, `starterCode` per language, initial test cases with both `input` and `displayInput` representations | ⬜ Todo |
| 7.3 | **Validator Agent** — writes optimal solution (operates blind to test cases) | ⬜ Todo |
| 7.4 | **Sandbox Cross-Validation** — LangGraph routes Validator's code → Judge0. On fail, error fed back to Creator Agent (loop repeats) | ⬜ Todo |
| 7.5 | **Edge-Case Hacker Agent** — generates boundary inputs, appends as `PRIVATE` test cases | ⬜ Todo |
| 7.6 | On full pipeline pass → upsert problem to PostgreSQL with `isPublished = true` | ⬜ Todo |
| 7.7 | Create basic Admin backend override script (or API route) to unpublish or delete a broken problem | ⬜ Todo |

---

## ⬜ Section 8 — Infrastructure & Deployment

> Ubuntu 22.04 LTS. Docker Compose with 6 isolated services.

| # | Task | Status |
|---|---|---|
| 8.1 | Write production `docker-compose.yml` with all 6 services (see table below) | ⬜ Todo |
| 8.2 | Set `--pids-limit 100` on Judge0 worker containers (fork bomb protection) | ⬜ Todo |
| 8.3 | Isolate Judge0 + Redis on internal bridge network (no outbound internet) | ⬜ Todo |
| 8.4 | AI Orchestrator on separate internal network (LLM API calls only, no student data exposure) | ⬜ Todo |
| 8.5 | Deploy to Ubuntu 22.04 LTS server | ⬜ Todo |

### Docker Services

| Service | Technology | Role |
|---|---|---|
| `backend` | Node.js + Express | API gateway, auth, DB transactions |
| `db` | PostgreSQL | Primary datastore |
| `ai-orchestrator` | Python + LangChain + LangGraph | Multi-agent problem generation |
| `redis` | Redis | Job queue for Judge0 |
| `judge0-api` | Ruby on Rails (Judge0) | Code execution REST API |
| `judge0-worker` | Sidekiq + isolate | Sandbox execution workers |