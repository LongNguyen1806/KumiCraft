# @reactcraft/server

Local Server: Fastify on `127.0.0.1`, project opening and trust, and later the dev server runner, the Source Editor, Undo history and the agent connection (SPEC-01 section 3).

- `src/core/` holds business logic and talks to the outside world only through ports in `src/core/ports/`.
- `src/adapters/` implements the ports with concrete libraries (SPEC-01 section 3.2).

Specification: SPEC-01, SPEC-03, SPEC-04 (server modules), SPEC-05.

| Command            | Purpose                              |
| ------------------ | ------------------------------------ |
| `pnpm dev` (root)  | Run server and Studio in watch mode  |
| `pnpm test` (root) | Unit, contract and integration tests |
