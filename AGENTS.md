# Repository Guidelines

## Project Structure & Module Organization
- `app/` – Next.js App Router entry (`layout.tsx`, `page.tsx`, global styles).
- `components/` – React UI; keep components small, typed, and push logic into `lib/`.
- `lib/` – core domain logic: `lib/session` (queue + advancement), `lib/ai` (Gemini grading), `lib/data` (types + adapter).
- `services/` – integration glue (e.g., Gemini service); prefer new code through `lib/ai/gradeTranslation`.
- `convex/`, `db/` – future data-layer implementations; keep persistence behind `DataAdapter` in `lib/data/types.ts`.
- `dist/` – build output; do not edit by hand.

## Build, Test, and Development Commands
- `pnpm install` (preferred) or `npm install` – install dependencies.
- `pnpm dev` – run dev server on `http://localhost:3000`.
- `pnpm build` / `pnpm start` – production build and serve.
- `pnpm lint` – run ESLint with Next.js config.
- `pnpm vitest` – run unit tests (Node environment).

## Coding Style & Naming Conventions
- TypeScript strict; prefer explicit types for exports and public functions.
- 2-space indent, single quotes, semicolons; let ESLint/Next defaults guide formatting.
- `PascalCase` React components (`Dashboard`, `ReviewStep`), `camelCase` functions/variables, `kebab-case` route segments.
- Keep `lib/` pure (no React/Next imports); side effects and I/O live in `app/`, `services/`, or Convex/DB adapters.
- Use `@/...` imports instead of long relative paths.

## Testing Guidelines
- Test runner: Vitest. Tests live in `__tests__` alongside code (`lib/session/__tests__`, `lib/ai/__tests__`).
- Name tests `*.test.ts`; `describe` by unit under test.
- For AI and data code, mock external services (`@google/generative-ai`, Convex) rather than calling the network.
- Target ~80% coverage for new logic; cover success and failure paths, especially session advancement and grading fallbacks.
- Run `pnpm vitest` and `pnpm lint` before opening a PR.

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat:`, `fix:`, `chore:`) as in existing history.
- Keep PRs focused and small (~50–200 LOC); one feature or fix per PR.
- PR description: short “what” and “why”, main modules touched, notable tradeoffs.
- Link issues when relevant; include screenshots or notes for UI changes.
- CI baseline: app builds, lints, and tests pass locally before requesting review.

## Security & Configuration Tips
- Use `.env.local` for secrets; never commit `.env*`.
- Gemini grading expects an API key: `GEMINI_API_KEY` for `lib/ai/gradeTranslation`; `API_KEY` is currently used in `services/geminiService`. Prefer new code using `lib/ai`.
- Configure Clerk and other credentials for real deployments; keep all keys server-side only.

