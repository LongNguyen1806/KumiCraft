# @reactcraft/server

Local Backend: Fastify server on `127.0.0.1`, workspace and Design Store, Target Project analysis, code generation, export transactions, backend scan and AI gateway.

- `src/core/` holds business logic and talks to the outside world only through ports in `src/core/ports/`.
- `src/adapters/` implements the ports with concrete libraries (SPEC-01.1 section 3.2).

Specification: SPEC-01.1, SPEC-03 part B, SPEC-04.1 to SPEC-04.5 (server modules), SPEC-05.

| Command            | Purpose                                                    |
| ------------------ | ---------------------------------------------------------- |
| `pnpm dev` (root)  | Run server and Studio in watch mode (from SPEC-07 WP-0.03) |
| `pnpm test` (root) | Unit and integration tests (from SPEC-07 WP-0.06)          |
