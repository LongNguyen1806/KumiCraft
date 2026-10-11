# @reactcraft/model

Design Model shared by the Studio UI and the Local Backend: Zod schema, Design Operations (`validate`, `apply`, `invert`), migrations, the styling map (`@reactcraft/model/styling`) and feature flags.

- Runs in both Node.js and the browser. It may import only `zod`, `nanoid` and its own files (SPEC-01.1 section 3.2).
- Line coverage must stay at 90% or above (ADR-BE-04).

Specification: SPEC-03 part A, SPEC-04.1 sections 3 to 5, SPEC-07 section 3.4.

| Command                 | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `pnpm typecheck` (root) | Type check every package                       |
| `pnpm test` (root)      | Unit and property tests (from SPEC-07 WP-0.06) |
