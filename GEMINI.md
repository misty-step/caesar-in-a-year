# Caesar in a Year - Gemini Context

See `AGENTS.md` for project structure, commands, and conventions.

## Gemini-Specific

### Shell Injection
Use `!{command}` syntax to inject live shell output into context.

### Web Grounding
Leverage Google Search for current docs and best practices.

### Corpus Tools
```bash
bun corpus:process -- --book 1 --chapter 1
bun corpus:sync
```
