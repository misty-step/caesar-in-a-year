# Repository Guidelines

## Project Structure & Module Organization
- `app/` – Next.js App Router entry (`layout.tsx`, `page.tsx`, global styles).
- `components/` – React UI; keep components small, typed, and push logic into `lib/`.
- `lib/` – core domain logic: `lib/session` (queue + advancement), `lib/ai` (Gemini grading), `lib/data` (types + adapter).
- `convex/`, `db/` – future data-layer implementations; keep persistence behind `DataAdapter` in `lib/data/types.ts`.
- `dist/` – build output; do not edit by hand.

## Build, Test, and Development Commands
- `bun install` – install dependencies.
- `bun dev` – run dev server on `http://localhost:3000`.
- `bun run build` / `bun run start` – production build and serve.
- `bun lint` – run ESLint with Next.js config.
- `bun vitest` – run unit tests (Node environment).

## Coding Style & Naming Conventions
- TypeScript strict; prefer explicit types for exports and public functions.
- 2-space indent, single quotes, semicolons; let ESLint/Next defaults guide formatting.
- `PascalCase` React components (`Dashboard`, `ReviewStep`), `camelCase` functions/variables, `kebab-case` route segments.
- Keep `lib/` pure (no React/Next imports); side effects and I/O live in `app/` or Convex/DB adapters.
- Use `@/...` imports instead of long relative paths.

## Testing Guidelines
- Test runner: Vitest. Tests live in `__tests__` alongside code (`lib/session/__tests__`, `lib/ai/__tests__`).
- Name tests `*.test.ts`; `describe` by unit under test.
- For AI and data code, mock external services (`@google/genai`, Convex) rather than calling the network.
- Target ~80% coverage for new logic; cover success and failure paths, especially session advancement and grading fallbacks.
- Run `bun vitest` and `bun lint` before opening a PR.

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat:`, `fix:`, `chore:`) as in existing history.
- Keep PRs focused and small (~50–200 LOC); one feature or fix per PR.
- PR description: short "what" and "why", main modules touched, notable tradeoffs.
- Link issues when relevant; include screenshots or notes for UI changes.
- CI baseline: app builds, lints, and tests pass locally before requesting review.

## Security & Configuration Tips
- Use `.env.local` for secrets; never commit `.env*`.
- `GEMINI_API_KEY` – used by `lib/ai/gradeTranslation.ts` for AI grading.
- Clerk keys (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) – authentication.
- Keep all secrets server-side only.


## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## Issue Tracking

**IMPORTANT**: Track all work in GitHub Issues/PRs. Do NOT use markdown TODO files as a second tracker.

### Quick Start

**List ready work:**
```bash
gh issue list --state open --limit 50
```

**Create new issues:**
```bash
gh issue create --title "Issue title" --body "Context, scope, acceptance criteria"
```

**Update and close:**
```bash
gh issue edit <id> --body-file /tmp/issue.md
gh issue close <id> --comment "Completed in #<pr>"
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: review open GitHub issues and PR comments
2. **Claim your task**: leave a clear status comment on issue/PR
3. **Work on it**: implement, test, document
4. **Discover new work?** open a linked GitHub issue and reference parent context
5. **Complete**: close the issue with a PR reference
6. **Commit together**: keep code, tests, and docs in the same PR so state stays aligned

### Managing AI-Generated Planning Documents

AI assistants often create planning and design documents during development:
- PLAN.md, IMPLEMENTATION.md, ARCHITECTURE.md
- DESIGN.md, CODEBASE_SUMMARY.md, INTEGRATION_PLAN.md
- TESTING_GUIDE.md, TECHNICAL_DESIGN.md, and similar files

**Best Practice: Use a dedicated directory for these ephemeral files**

**Recommended approach:**
- Create a `history/` directory in the project root
- Store ALL AI-generated planning/design docs in `history/`
- Keep the repository root clean and focused on permanent project files
- Only access `history/` when explicitly asked to review past planning

**Example .gitignore entry (optional):**
```
# AI planning documents (ephemeral)
history/
```

**Benefits:**
- ✅ Clean repository root
- ✅ Clear separation between ephemeral and permanent documentation
- ✅ Easy to exclude from version control if desired
- ✅ Preserves planning history for archeological research
- ✅ Reduces noise when browsing the project

### CLI Help

Run `gh issue --help` and `gh pr --help` to see available flags and workflows.

### Important Rules

- ✅ Use GitHub Issues/PR comments for all task tracking
- ✅ Keep issue/PR status current as work progresses
- ✅ Store AI planning docs in `history/` directory
- ✅ Run `gh <cmd> --help` to discover available flags
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT duplicate tracking systems
- ❌ Do NOT clutter repo root with planning documents

For more details, see README.md and QUICKSTART.md.
