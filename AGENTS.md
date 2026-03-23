# AGENTS.md

## Purpose
- This guide is for coding agents working in `PriceGhost`.
- It captures how to build, test, and edit code safely in this repository.
- Follow existing conventions over personal preference.

## Repository Layout
- `backend/`: Node + Express + TypeScript API, scraping, scheduler, Postgres data access.
- `frontend/`: React + TypeScript + Vite web app.
- `database/init.sql`: bootstrap schema for local/dev DB setup.
- `docker-compose.yml`: local stack (Postgres + backend + frontend images).

## Tooling Snapshot
- Language: TypeScript in both backend and frontend.
- Backend runtime: Node (Docker uses Node 20; README states Node 18+).
- Backend tests: Jest + ts-jest.
- Frontend bundler/dev server: Vite.
- Database: PostgreSQL.
- Lint/format: no dedicated repo-level lint or prettier config is currently committed.

## Install Commands
```bash
# from repo root
npm --prefix backend install
npm --prefix frontend install
```

## Build Commands
```bash
# backend build (TypeScript compile to dist)
npm --prefix backend run build

# frontend build (tsc -b + vite build)
npm --prefix frontend run build

# build both
npm --prefix backend run build && npm --prefix frontend run build
```

## Dev Commands
```bash
# backend dev server (watch mode)
npm --prefix backend run dev

# frontend dev server
npm --prefix frontend run dev

# frontend preview of production build
npm --prefix frontend run preview
```

## Database Commands
```bash
# initialize database objects from backend script
npm --prefix backend run db:init

# optional local stack
docker-compose up -d
```

## Test Commands
```bash
# run all backend tests
npm --prefix backend test

# run a single test file (important)
npm --prefix backend test -- tests/utils/priceParser.test.ts

# run a single test by name pattern
npm --prefix backend test -- tests/utils/priceParser.test.ts -t "parses USD properly"
```

## Lint and Type-Check Guidance
- There is no `npm run lint` script in either package at the time of writing.
- Use builds as the primary CI-quality check:
  - `npm --prefix backend run build`
  - `npm --prefix frontend run build`
- If you add linting, do it only when explicitly requested.

## Runtime and Env Notes
- Backend env is loaded via `dotenv`.
- Required backend env keys: `DATABASE_URL`, `JWT_SECRET` (plus `PORT`, `NODE_ENV` as needed).
- Scheduler auto-starts unless `NODE_ENV === 'test'`.
- Frontend API base URL comes from `VITE_API_URL` (defaults to `/api`).

## Code Style: Global
- Use TypeScript strictness as implemented by project `tsconfig` files.
- Prefer small, explicit functions and early returns for invalid states.
- Keep side effects localized and obvious.
- Match existing quote/semicolon style: single quotes + semicolons.
- Use 2-space indentation.
- Favor readable code over clever abstractions.

## Imports and File Organization
- Import external packages first, then internal modules.
- When both groups are present, separate groups with a blank line.
- Keep import lists stable and minimal; remove unused imports.
- Prefer explicit type imports where already used in file patterns.

## Naming Conventions
- React components: PascalCase (`ProductCard`, `PriceSelectionModal`).
- Functions/variables: camelCase.
- Constants: UPPER_SNAKE_CASE for shared immutable constants.
- Database columns and many API payload fields are snake_case; preserve that contract.
- Domain literals use union types, e.g. `StockStatus`, `AIStatus`, `NotificationType`.

## Backend Conventions
- Route handlers:
  - Validate input early.
  - Return after `res.status(...).json(...)` branches.
  - Wrap async logic in `try/catch`.
  - Log internal errors with context and return safe messages.
- Auth:
  - Use `AuthRequest` and `authMiddleware` for protected routes.
  - Differentiate auth failures (`401`) from server failures (`500`).
- Data access:
  - Keep SQL in query modules (`backend/src/models/index.ts`).
  - Always parameterize SQL (`$1`, `$2`, ...); do not string-concatenate user input.
  - For dynamic updates, follow existing `fields[]` + `values[]` pattern.
- Scraping/services:
  - Preserve method-specific confidence/candidate logic.
  - Preserve stock status semantics: `in_stock | out_of_stock | unknown`.

## Frontend Conventions
- Functional components + hooks only.
- Type props with interfaces near component declarations.
- Keep API contracts centralized in `frontend/src/api/client.ts`.
- Use narrow type guards for union API responses.
- Use local component state for UI interactions; avoid hidden global mutable state.
- Reuse shared formatting helpers (for example currency formatting) instead of duplicating logic.
- Existing code uses both global CSS and component-scoped `<style>` blocks; follow local file pattern.

## Types and Validation
- Do not weaken strict typing without a strong reason.
- Avoid `any`; if unavoidable, isolate and document why.
- Parse numeric route/query params with radix (`parseInt(value, 10)`).
- Validate required request fields before DB/service calls.
- Keep server/client interfaces aligned when adding fields.

## Error Handling and Logging
- Prefer actionable logs, e.g. `console.error('Error updating product:', error)`.
- Do not leak secrets or tokens in logs.
- Return user-facing messages that are concise and non-sensitive.
- For recoverable per-item failures (e.g. scheduler loops), continue processing next item.

## Testing Guidance
- Backend tests live under `backend/tests/**`.
- Follow existing Jest style: `describe` + focused `it` cases.
- Keep fixtures under `backend/tests/fixtures/**` when testing scraper behavior.
- Add or update tests when changing parser/scraper normalization logic.
- Frontend currently has no committed test runner; rely on build and manual verification unless asked to add tests.

## Agent Workflow Checklist
- Before edits: inspect related backend/frontend contracts for field naming.
- After edits: run relevant build and tests (or targeted single-test command).
- For backend behavior changes: run at least impacted Jest file.
- For frontend behavior changes: run `npm --prefix frontend run build` and sanity-check UI flow.
- Keep changes scoped; do not refactor unrelated areas opportunistically.

## Cursor/Copilot Rules Status
- No `.cursorrules` file was found.
- No `.cursor/rules/` directory was found.
- No `.github/copilot-instructions.md` file was found.
- If any of these are added later, treat them as higher-priority repository instructions.
