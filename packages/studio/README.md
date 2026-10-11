# @reactcraft/studio

Studio UI: React 19, Vite 8, canvas in an iframe, overlay, drag and drop, inspector, layer tree. Every user-facing string goes through i18n (`vi`, `en`).

Specification: SPEC-01.2, SPEC-04.1 (Studio modules), SPEC-05 section 6.

| Command                  | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `pnpm dev` (root)        | Vite dev server with `/api` proxy (from SPEC-07 WP-0.03)   |
| `pnpm check:i18n` (root) | Check that `vi` and `en` keys match (from SPEC-07 WP-0.05) |
