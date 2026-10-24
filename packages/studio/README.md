# @kumicraft/studio

Studio UI: React 19, Vite 8 and the React Compiler. It hosts the Canvas (the project's own dev server in an iframe, ADR-FE-04), the Layer Tree, the Inspector and later the AI chat. Every user-facing string goes through i18n (`vi`, `en`).

Specification: SPEC-01 (ADR-FE-xx), SPEC-04 (Studio modules), SPEC-05 section 4.

| Command                  | Purpose                             |
| ------------------------ | ----------------------------------- |
| `pnpm dev` (root)        | Vite dev server with `/api` proxy   |
| `pnpm check:i18n` (root) | Check that `vi` and `en` keys match |
