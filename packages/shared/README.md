# @kumicraft/shared

Schemas and types shared by the Studio, the Local Server and the Bridge: error codes, the `.kumicraft/workspace.json` file, responsive rules and feature flags (SPEC-01 section 3.2 rule 2, SPEC-03).

- Runs in Node.js and in the browser. It may import only `zod` and its own files: no `node:*`, no DOM API.
- Line coverage must stay at 90% or above (SPEC-02 section 9).

| Command                 | Purpose                  |
| ----------------------- | ------------------------ |
| `pnpm typecheck` (root) | Type check every package |
| `pnpm test` (root)      | Unit tests               |
