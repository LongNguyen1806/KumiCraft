# @kumicraft/style-tailwind

The Tailwind class model: read a class string into CSS properties, and write a property change back as classes, for every screen and state (03-kien-truc-dich.md section 3.3, ADR-A4).

- Pure functions only: no `node:*`, no DOM API, no I/O. It may import only `@kumicraft/shared`.
- The Studio uses it to show values and preview at once; the server runs the same functions to decide the class an edit writes.
